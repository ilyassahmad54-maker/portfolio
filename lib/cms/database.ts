import 'server-only';
import postgres from 'postgres';
import { CmsUnavailable, safeDatabaseError } from './errors';
import { assertPreviewConfiguration } from './preview';

export function createCmsQuery(factory: typeof postgres = postgres, uriProvider = () => process.env.SUPABASE_DATABASE_URL, deadlineMs = 8000) {
  let client: ReturnType<typeof postgres> | undefined;
  function connection() {
    if (client) return client;
    try {
      assertPreviewConfiguration();
      const uri = uriProvider();
      if (!uri) throw new Error();
      const url = new URL(uri);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password ||
          url.search || url.hash || !/^\/(?:[A-Za-z0-9_-]+)$/.test(url.pathname) ||
          !/^(?:[A-Za-z0-9.-]+\.pooler\.supabase\.com|db\.[A-Za-z0-9-]+\.supabase\.co)$/.test(url.hostname) ||
          /^(postgres|supabase_admin|service_role|authenticator|portfolio_cms_owner|portfolio_cms_seed)(?:\.|$)/i.test(decodeURIComponent(url.username))) throw new Error();
      // Reserved connections issue one statement at a time, avoiding pipelining
      // across shared transaction-pooler connections. Mutations are single SQL calls.
      const ca=process.env.SUPABASE_DATABASE_CA;
      if(ca && (ca.length>32768 || !ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')))throw new Error();
      client = factory(uri, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 20,
        max_lifetime: 60 * 30, ssl: { rejectUnauthorized: true, ...(ca ? {ca} : {}) }, onnotice: () => {} });
      return client;
    } catch { throw new CmsUnavailable('configuration'); }
  }
  return async function query(statement: string, parameters: (string | number | boolean | null)[] = []): Promise<unknown> {
    const database = connection();
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = async () => {
      const reserved = await database.reserve();
      try {
        if (expired) throw new CmsUnavailable('database_timeout');
        // Detect accidental use of an elevated/migration login before any content call.
        const identity = await reserved.unsafe(`SELECT NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
          AND pg_has_role(current_user,'portfolio_cms_runtime','USAGE')
          AND NOT pg_has_role(current_user,'portfolio_cms_owner','MEMBER')
          AND NOT pg_has_role(current_user,'portfolio_cms_seed','MEMBER')
          AND NOT EXISTS(SELECT 1 FROM pg_roles auth_owner WHERE auth_owner.rolname='portfolio_preview_auth_owner' AND pg_has_role(current_user,auth_owner.oid,'MEMBER')) AS allowed
          FROM pg_roles WHERE rolname=current_user`);
        if (expired) throw new CmsUnavailable('database_timeout');
        if (identity.length !== 1 || identity[0].allowed !== true) throw new CmsUnavailable('configuration');
        const rows = await reserved.unsafe(statement, parameters);
        if (rows.length !== 1 || !Object.hasOwn(rows[0], 'result')) throw new CmsUnavailable('database_response');
        return rows[0].result;
      } finally { reserved.release(); }
    };
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        if (client === database) client = undefined;
        // Close this instance's pool on a deadline, including queued reservations.
        // No timed-out write is allowed to start later on a released connection.
        void database.end({ timeout: 0 }).catch(() => {});
        reject(new CmsUnavailable('database_timeout'));
      }, deadlineMs);
    });
    try { return await Promise.race([work(), deadline]); }
    catch (error) { throw error instanceof CmsUnavailable ? error : safeDatabaseError(error); }
    finally { if (timer) clearTimeout(timer); }
  };
}

export const queryCms = createCmsQuery();
