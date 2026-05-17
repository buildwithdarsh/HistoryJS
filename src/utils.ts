import type { HistoryLocation } from './types.js';

const HJS_KEY = '__hjs__';

export interface InternalStateWrapper<TState> {
  [HJS_KEY]: {
    id: string;
    index: number;
    scroll?: { x: number; y: number };
  };
  user: TState | null;
}

export function isWrapped<TState>(
  value: unknown,
): value is InternalStateWrapper<TState> {
  return (
    typeof value === 'object' &&
    value !== null &&
    HJS_KEY in (value as Record<string, unknown>)
  );
}

export function wrapState<TState>(
  user: TState | null,
  meta: InternalStateWrapper<TState>[typeof HJS_KEY],
): InternalStateWrapper<TState> {
  return { [HJS_KEY]: meta, user };
}

export function unwrapState<TState>(
  raw: unknown,
): { user: TState | null; meta: InternalStateWrapper<TState>[typeof HJS_KEY] | null } {
  if (isWrapped<TState>(raw)) {
    return { user: raw.user, meta: raw[HJS_KEY] };
  }
  return { user: (raw as TState | null) ?? null, meta: null };
}

export function locationOf(win: Window): HistoryLocation {
  const { pathname, search, hash, href, origin } = win.location;
  return { pathname, search, hash, href, origin };
}

export function parseLocation(href: string): HistoryLocation {
  const u = new URL(href);
  return {
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    href: u.href,
    origin: u.origin,
  };
}

let idCounter = 0;
export function makeId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `hjs_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

export function resolveUrl(input: string | URL, base: string): string {
  if (input instanceof URL) return input.toString();
  return new URL(input, base).toString();
}
