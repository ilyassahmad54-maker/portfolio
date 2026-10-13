import { createHash } from 'node:crypto';
import { validatePortfolio } from './validation';

/** Sort object keys only. Array order and all content values remain unchanged. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  validatePortfolio(value);
  return createHash('sha256').update(canonicalJSON(value)).digest('hex');
}
