export type CmsFailure = 'storage' | 'configuration' | 'database' | 'database_timeout' | 'database_response' | 'redis' | 'cache' | 'authentication';
export class CmsUnavailable extends Error {
  constructor(readonly category: CmsFailure) { super('CMS temporarily unavailable'); this.name = 'CmsUnavailable'; }
}
export class CmsHttpError extends Error {
  constructor(readonly status: number, readonly publicMessage: string) { super(publicMessage); this.name = 'CmsHttpError'; }
}

/** Inspect only known SQLSTATE codes, never upstream messages, queries or arguments. */
export function safeDatabaseError(error: unknown): Error {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'P0404') return new CmsHttpError(404, 'Revision not found.');
  if (code === 'P0409' || code === '23505' || code === '40001') return new CmsHttpError(409, 'Content changed or request conflicts. Reload the current state.');
  if (['22023', '22P02', '23514'].includes(String(code))) return new CmsHttpError(422, 'Content or asset references are invalid.');
  if (['57014', '55P03', '40P01'].includes(String(code))) return new CmsUnavailable('database_timeout');
  return new CmsUnavailable('database');
}
