import schemaDocument from './portfolio.schema.json';
import type { PortfolioData } from '../../types/portfolio';

export const CONTENT_SCHEMA_VERSION = 1;
export const MAX_CONTENT_BYTES = 1024 * 1024;

interface Schema {
  type: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export class ContentValidationError extends Error {
  constructor(readonly field: string, reason: string) {
    // Field/reason only: never echo submitted content or credentials.
    super(`${field}: ${reason}`);
    this.name = 'ContentValidationError';
  }
}

export function validContentFormat(format: string, value: string): boolean {
  if (/[\s\u0000-\u001f\u007f\\]/.test(value)) return false;
  switch (format) {
    case 'web-link': {
      if (value === '' || value === '#') return true;
      // Deliberately conservative, shared with the SQL validator. No arbitrary image fetching.
      const match = /^https:\/\/((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})(?::443)?(?:[/?#][^\s\\]*)?$/.exec(value);
      return !!match && !/\.(local|internal)$/i.test(match[1]);
    }
    case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    case 'social-link':
      return (value.startsWith('https:') && validContentFormat('web-link', value)) ||
        /^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value) ||
        /^tel:\+?[0-9()-]{3,30}$/.test(value);
    case 'formspree': return /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(value);
    case 'cv-path': return value === '/cv.pdf' || /^\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.pdf$/.test(value);
    case 'image-ref':
      return /^\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif)$/.test(value) ||
        /^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
    default: return false;
  }
}

function check(value: unknown, schema: Schema, field: string): void {
  const fail = (reason: string): never => { throw new ContentValidationError(field, reason); };
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected object');
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) {
      if (!Object.hasOwn(schema.properties!, key)) fail('unknown field');
    }
    for (const key of schema.required!) {
      if (!Object.hasOwn(object, key)) throw new ContentValidationError(`${field}.${key}`, 'required');
    }
    for (const [key, item] of Object.entries(object)) check(item, schema.properties![key], `${field}.${key}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('expected array');
    const array = value as unknown[];
    if (array.length > schema.maxItems!) fail('too many items');
    array.forEach((item, index) => check(item, schema.items!, `${field}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') fail('expected string');
    const string = value as string;
    const length = Array.from(string).length;
    if (length < (schema.minLength ?? 0) || length > schema.maxLength!) fail('invalid length');
    if (schema.enum && !schema.enum.includes(string)) fail('unsupported value');
    if (schema.pattern && new RegExp(schema.pattern).exec(string)?.[0] !== string) fail('invalid format');
    if (string.includes('\u0000')) fail('null byte forbidden');
    if (schema.format && !validContentFormat(schema.format, string)) fail('unsafe or unsupported reference');
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < schema.minimum! || value > schema.maximum!) fail('invalid number');
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') fail('expected boolean');
  } else fail('unsupported schema');
}

/** Validate without coercing, dropping fields, normalizing URLs, or changing order. */
export function validatePortfolio(value: unknown): asserts value is PortfolioData {
  let encoded: string;
  try { encoded = JSON.stringify(value); } catch { throw new ContentValidationError('$', 'not JSON'); }
  if (!encoded || new TextEncoder().encode(encoded).length > MAX_CONTENT_BYTES) throw new ContentValidationError('$', 'content exceeds 1 MiB');
  check(value, schemaDocument as Schema, '$');
  const data = value as PortfolioData;
  for (const section of ['skills', 'experience', 'projects', 'education', 'certifications'] as const) {
    const ids = data[section].map(item => item.id);
    if (new Set(ids).size !== ids.length) throw new ContentValidationError(`$.${section}`, 'duplicate IDs');
  }
  const platforms = data.socialLinks.map(link => link.platform);
  if (new Set(platforms).size !== platforms.length) throw new ContentValidationError('$.socialLinks', 'duplicate platforms');
}
