import type { QueryInput, QueryValue } from './types.js';

/** Parse a query string into a plain object. Arrays are produced when a key appears multiple times. */
export function parseQuery(search: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [key, value] of params.entries()) {
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing as string, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Serialize an object into a leading-`?` query string. Returns '' for empty objects. */
export function stringifyQuery(input: QueryInput): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (v === undefined || v === null) continue;
        params.append(key, String(v));
      }
    } else {
      params.set(key, String(raw));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Merge new params into an existing query string (undefined/null removes the key). */
export function mergeQuery(currentSearch: string, patch: QueryInput): string {
  const params = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      params.delete(key);
    } else if (Array.isArray(value)) {
      params.delete(key);
      for (const v of value) {
        if (v === undefined || v === null) continue;
        params.append(key, String(v));
      }
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Read a single query value from a search string. Returns the first value if the key repeats. */
export function getQueryValue(search: string, key: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(key);
}

export function hasQueryKey(search: string, key: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.has(key);
}

export type { QueryInput, QueryValue };
