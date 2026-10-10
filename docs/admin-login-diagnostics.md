# Admin login 503 diagnostics

The client sends a JSON command array via HTTPS POST to the database REST root URL with `Authorization: Bearer <raw REST token>` and `Content-Type: application/json`. This matches Upstash's [REST API](https://upstash.com/docs/redis/features/restapi). The environment variable must contain the raw write-capable Redis REST token for the same database as the endpoint, without quotes, whitespace, or an Authorization/Bearer prefix. Redis TCP passwords, management API credentials, and QStash tokens are different credentials. Do not paste any credential into logs or support messages.

## Request order and explicit 503 returns

There are exactly three explicit application 503 returns:

- `app/api/admin/login/route.ts`: its outer catch returns `Admin login unavailable`.
- `app/api/admin/session/route.ts`: its catch returns `authenticated: false` with status 503.
- `app/api/admin/logout/route.ts`: its catch returns `Logout unavailable`.

Login executes these steps inside the outer catch:

1. `rate_limit`: read and validate configuration, then execute atomic Redis `EVAL` containing `INCR` and first-attempt `EXPIRE 900`. A configuration, fetch, HTTP, JSON, Redis error or invalid result failure returns 503. This happens BEFORE reading or verifying the passcode.
2. `request_body`: verify media type, read at most 2048 bytes, and parse JSON. Ordinary invalid input returns 400 or 413. Unexpected body stream, cancellation or buffering exceptions return 503.
3. `credential_check`: validate the passcode server-side. Wrong credentials return 401. Configuration or unexpected comparison errors return 503.
4. `session_revoke`: if a syntactically valid existing session cookie is supplied, execute `DEL`. Any store failure returns 503 and stops login. No cookie means no Redis deletion is attempted.
5. `session_create`: generate a random token and execute `SET ... EX 3600`. Any store failure, unexpected token-generation error or response-construction error returns 503. `SET` must now return `OK`; otherwise no new cookie is issued.
6. `cookie`: issue the secure session cookie. An unexpected cookie-writing exception returns 503.

Session validation uses `GET` only for a syntactically valid cookie; store exceptions return 503, while missing, malformed, unknown or expired sessions return 401. Logout executes `DEL` for a syntactically valid cookie, then clears the cookie; store or cookie exceptions return 503. Origin failures on login/logout return 403 before any Redis operation.

## Upstream failures versus application statuses

- Upstash HTTP 401 (missing/invalid token), or 403: application 503, category `redis_http_auth`.
- Upstash HTTP 429: application 503, category `redis_http_rate_limit`. This is distinct from the application's five-attempt limit, which returns 429 only after a valid EVAL result greater than five.
- Other non-success HTTP responses, including 400 command/ACL/syntax failures and 5xx: application 503, category `redis_http_error`.
- A Redis `error` envelope on a successful HTTP response: application 503. Known WRONGPASS/NOAUTH codes map to `redis_auth`, NOPERM/READONLY to `redis_permission`, other codes to `redis_response_error`. Non-success responses are classified by HTTP status without reading their bodies.
- Invalid JSON, an invalid/missing result envelope, or the wrong result type: application 503, categories `redis_invalid_json`, `redis_invalid_response`, or `redis_invalid_result`. Previously a malformed EVAL result could misleadingly produce 429, and an unconfirmed SET response could produce an unusable session cookie; both now fail closed.
- Five-second aborts/timeouts and transport failures: application 503, `redis_timeout` or `redis_network`. Redirects are rejected instead of forwarding credentials.
- Missing/malformed configuration: application 503, `configuration` plus a fixed reason label. New checks reject non-root/non-HTTPS REST URLs, URL credentials/query strings, and token whitespace or quotes without exposing values.

A Vercel outbound POST trace establishes that fetch was attempted, not that Upstash authenticated or executed a command. For that attempted call, the earlier configuration checks passed; absent/short passcode or completely missing token/URL would have failed before the outbound request. Zero processed commands, minimal bandwidth and no stored keys are consistent with pre-execution authentication/authorization rejection, but do not prove it. Wrong database/time range, dashboard delay, expired counters, and transport failures remain possible. A successful first EVAL should create a counter with a 15-minute TTL; a session SET is attempted only after valid admin credentials and any required revocation succeed.

## Safe Vercel log interpretation

Each caught failure emits one structured `admin_auth_failure` log containing only route, stage, category, optional fixed Redis operation, optional upstream HTTP status, optional configuration reason, and application response status. There are no response bodies, raw exceptions/stacks, URLs, Authorization headers, passcodes, tokens, session values/hashes, keys, IP addresses, or request bodies.

Example (illustrative, not an observed production log):

```json
{"event":"admin_auth_failure","route":"login","stage":"rate_limit","category":"redis_http_auth","operation":"EVAL","upstreamHttpStatus":401,"responseStatus":503}
```

This would locate rejection at the first Redis call. An upstream 400 at the same stage points toward command execution or permissions; `session_create` / `SET` indicates the rate limiter and credential check already succeeded. A missing upstream status with a Redis transport category means fetch did not return an HTTP response. Configuration and unexpected failures also omit that field; an unexpected failure may occur after earlier commands succeeded. Category labels stay server-side; browser error responses remain generic.

No Production credentials were read or tested during this investigation. Tests inject synthetic REST responses and capture logs to check for accidental disclosure. A definitive production root cause needs the upstream status/category from the actual failing deployment; diagnostic changes are not active until separately approved and deployed. Environment updates in Vercel also require a new deployment to affect running functions. Do not share secret values.
