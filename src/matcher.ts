import type { RouteMatch } from './types.js';

interface CompiledPattern {
  regex: RegExp;
  keys: string[];
}

const cache = new Map<string, CompiledPattern>();

function escapeRegex(s: string): string {
  return s.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a route pattern into a regex.
 *
 * Supported syntax:
 *  - `/users/:id`        — named param, matches a single segment
 *  - `/files/:path*`     — splat, matches the rest including slashes
 *  - `/posts/:slug?`     — optional segment
 *  - `/static/path`      — literal
 */
export function compilePattern(pattern: string): CompiledPattern {
  const cached = cache.get(pattern);
  if (cached) return cached;

  const keys: string[] = [];
  const trimmed = pattern.endsWith('/') && pattern.length > 1 ? pattern.slice(0, -1) : pattern;
  const segments = trimmed.split('/');

  const parts = segments.map((seg) => {
    if (seg === '') return '';
    if (seg.startsWith(':')) {
      let body = seg.slice(1);
      let optional = false;
      let splat = false;
      if (body.endsWith('?')) {
        optional = true;
        body = body.slice(0, -1);
      } else if (body.endsWith('*')) {
        splat = true;
        body = body.slice(0, -1);
      }
      keys.push(body);
      if (splat) return '(.*)';
      if (optional) return '?([^/]+)?';
      return '([^/]+)';
    }
    return escapeRegex(seg);
  });

  const source = '^' + parts.join('/') + '/?$';
  const compiled: CompiledPattern = { regex: new RegExp(source), keys };
  cache.set(pattern, compiled);
  return compiled;
}

/** Match a pathname against a pattern. Returns the params object or null. */
export function matchPattern<TParams extends Record<string, string> = Record<string, string>>(
  pattern: string,
  pathname: string,
): RouteMatch<TParams> | null {
  const { regex, keys } = compilePattern(pattern);
  const match = regex.exec(pathname);
  if (!match) return null;

  const params = {} as Record<string, string>;
  keys.forEach((key, i) => {
    const value = match[i + 1];
    if (value !== undefined) params[key] = decodeURIComponent(value);
  });

  return { pattern, path: pathname, params: params as TParams };
}

/** Build a URL from a pattern and params: `('/users/:id', { id: '42' })` → `'/users/42'`. */
export function buildPath(pattern: string, params: Record<string, string | number>): string {
  return pattern.replace(/:([A-Za-z_][\w]*)([?*])?/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) return '';
    return encodeURIComponent(String(value));
  });
}
