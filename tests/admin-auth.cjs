const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load() {
  const entries = new Map();
  const expires = new Map();
  let now = 0;
  const commands = [];
  let unavailable = false;
  const code = ts.transpileModule(fs.readFileSync('lib/admin.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const env = { NODE_ENV: 'production', VERCEL: '1', ADMIN_PASSCODE: 'random-test-only-value-12345', UPSTASH_REDIS_REST_URL: 'https://test.invalid', UPSTASH_REDIS_REST_TOKEN: 'test-only' };
  const fetch = async (_, options) => {
    if (unavailable) throw new Error('Redis offline');
    assert.equal(options.headers.Authorization, `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`);
    assert.equal(options.cache, 'no-store');
    const command = JSON.parse(options.body);
    commands.push(command);
    const [cmd, key, value] = command;
    for (const [key, until] of expires) if (until <= now) { entries.delete(key); expires.delete(key); }
    let result;
    if (cmd === 'SET') { assert.equal(command[3], 'EX'); entries.set(key, value); expires.set(key, now + command[4]); result = 'OK'; }
    if (cmd === 'GET') result = entries.get(key) || null;
    if (cmd === 'DEL') result = entries.delete(key) ? 1 : 0;
    if (cmd === 'EVAL') { const bucket = JSON.parse(options.body)[3]; const n = (entries.get(bucket) || 0) + 1; entries.set(bucket,n); if (n === 1) expires.set(bucket, now + 900); result = n; }
    return { ok: true, json: async () => ({ result }) };
  };
  vm.runInNewContext(code, { exports, require: name => name === 'server-only' ? {} : require(name), process: { env }, fetch, AbortSignal, Buffer });
  return { api: exports, env, entries, commands, advance: seconds => { now += seconds; }, offline: () => { unavailable = true; } };
}
const request = token => ({ cookies: { get: () => token ? { value: token } : undefined }, headers: new Headers({ origin: 'https://portfolio.test', 'x-vercel-forwarded-for': '192.0.2.1' }), nextUrl: { origin: 'https://portfolio.test' } });
test('opaque sessions validate, revoke, and invalidate on credential rotation', async () => {
  const { api, env } = load();
  assert.equal(await api.sessionValid(request()), false);
  assert.equal(await api.sessionValid(request('forged')), false);
  assert.equal(await api.sessionValid(request('a'.repeat(64))), false);
  const token = await api.newSession();
  assert.equal(await api.sessionValid(request(token)), true);
  await api.revoke(request(token));
  assert.equal(await api.sessionValid(request(token)), false);
  const second = await api.newSession();
  env.ADMIN_PASSCODE += '-rotated';
  assert.equal(await api.sessionValid(request(second)), false);
  assert.equal(api.cookieOptions.httpOnly, true);
  assert.equal(api.cookieOptions.secure, true);
  assert.equal(api.cookieOptions.sameSite, 'strict');
  assert.equal(api.cookieOptions.path, '/');
  assert.equal(api.cookieOptions.maxAge, 3600);
  assert.equal(api.cookieName, '__Host-admin-session');
});
test('credentials, configuration, origins, and shared rate limiting', async () => {
  const { api, env } = load();
  assert.equal(api.validPasscode(env.ADMIN_PASSCODE), true);
  assert.equal(api.validPasscode('wrong'), false);
  assert.equal(api.sameOrigin(request()), true);
  const foreign = request(); foreign.headers.set('origin', 'https://attacker.test');
  assert.equal(api.sameOrigin(foreign), false);
  for (let n = 0; n < 5; n++) assert.equal(await api.limited(request()), false);
  assert.equal(await api.limited(request()), true);
  delete env.ADMIN_PASSCODE;
  assert.throws(() => api.config());
});

function route(path, api) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === '@/lib/admin' ? api : require(name), Buffer });
  return exports;
}
test('login/logout endpoints enforce origins, cookies and revocation', async () => {
  const { NextRequest } = require('next/server');
  const { api, env } = load();
  const login = route('app/api/admin/login/route.ts', api);
  const logout = route('app/api/admin/logout/route.ts', api);
  const session = route('app/api/admin/session/route.ts', api);
  const make = (path, method, passcode, origin = 'https://portfolio.test', cookie) => new NextRequest(`https://portfolio.test/api/admin/${path}`, {
    method, headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ passcode }) } : {}),
  });
  assert.equal((await session.GET(make('session', 'GET'))).status, 401);
  assert.equal((await login.POST(make('login', 'POST', env.ADMIN_PASSCODE, 'https://evil.test'))).status, 403);
  assert.equal((await login.POST(make('login', 'POST', 'wrong'))).status, 401);
  const response = await login.POST(make('login', 'POST', env.ADMIN_PASSCODE));
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.equal((await session.GET(make('session', 'GET', undefined, undefined, cookie))).status, 200);
  assert.equal((await logout.POST(make('logout', 'POST', undefined, 'https://evil.test', cookie))).status, 403);
  assert.equal((await logout.POST(make('logout', 'POST', undefined, undefined, cookie))).status, 200);
  assert.equal((await session.GET(make('session', 'GET', undefined, undefined, cookie))).status, 401);
  delete env.ADMIN_PASSCODE;
  assert.equal((await login.POST(make('login', 'POST', 'wrong'))).status, 503);
});

test('sessions expire after one hour and login buckets expire after fifteen minutes', async () => {
  const { api, advance, commands } = load();
  const token = await api.newSession();
  assert.equal(commands[0][4], 3600);
  advance(3599);
  assert.equal(await api.sessionValid(request(token)), true);
  advance(1);
  assert.equal(await api.sessionValid(request(token)), false);
  for (let n = 0; n < 5; n++) await api.limited(request());
  assert.equal(await api.limited(request()), true);
  advance(900);
  assert.equal(await api.limited(request()), false);
});
test('endpoints fail closed during Redis outages and rate limiting returns 429', async () => {
  const { NextRequest } = require('next/server');
  const { api, env, offline } = load();
  const login = route('app/api/admin/login/route.ts', api);
  const session = route('app/api/admin/session/route.ts', api);
  const logout = route('app/api/admin/logout/route.ts', api);
  const make = () => new NextRequest('https://portfolio.test/api/admin/login', { method: 'POST', headers: { origin: 'https://portfolio.test', 'content-type': 'application/json' }, body: JSON.stringify({ passcode: 'wrong' }) });
  for (let n = 0; n < 5; n++) assert.equal((await login.POST(make())).status, 401);
  const response = await login.POST(make());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '900');
  const token = await api.newSession();
  offline();
  assert.equal((await login.POST(make())).status, 503);
  const authenticated = new NextRequest('https://portfolio.test/api/admin/session', { headers: { cookie: `${api.cookieName}=${token}`, origin: 'https://portfolio.test' } });
  assert.equal((await session.GET(authenticated)).status, 503);
  assert.equal((await logout.POST(authenticated)).status, 503);
});
test('login rejects malformed and oversized bodies, including bodies without Content-Length', async () => {
  const { NextRequest } = require('next/server');
  const { api } = load();
  const login = route('app/api/admin/login/route.ts', api);
  const make = body => new NextRequest('https://portfolio.test/api/admin/login', { method: 'POST', headers: { origin: 'https://portfolio.test', 'content-type': 'application/json' }, body });
  assert.equal((await login.POST(make('{'))).status, 400);
  assert.equal((await login.POST(make('x'.repeat(2049)))).status, 413);
  assert.equal((await login.POST(make('null'))).status, 401);
});
