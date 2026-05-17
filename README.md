# history.js

A modern, typed, framework-agnostic wrapper over the browser History API. The 2026 successor to [browserstate/history.js](https://github.com/browserstate/history.js/).

[![npm](https://img.shields.io/badge/npm-v1.0.0-bf5af2)](https://www.npmjs.com/package/@buildwithdarsh/history.js)
[![bundle](https://img.shields.io/badge/gzipped-~3KB-2997ff)](#)
[![license](https://img.shields.io/badge/license-MIT-30d158)](LICENSE)
[![types](https://img.shields.io/badge/TypeScript-first-2997ff)](#)

The original `history.js` shipped in 2010 to paper over the HTML4/HTML5 split. Every browser worth supporting today implements `pushState`/`popstate` natively, so this rewrite drops the HTML4 fallback, the jQuery/MooTools/Prototype adapters, and the global `History` namespace — and gives you what apps actually want now: typed entries, async navigation guards, query helpers, route matching, link interception, and a virtual stack.

## Install

```bash
npm install @buildwithdarsh/history.js
# or
pnpm add @buildwithdarsh/history.js
# or
yarn add @buildwithdarsh/history.js
```

Or via CDN:

```html
<script src="https://unpkg.com/@buildwithdarsh/history.js"></script>
```

## Quick start

```ts
import { getHistory } from '@buildwithdarsh/history.js';

type AppState = { view: 'home' | 'profile'; userId?: string };

const history = getHistory<AppState>();

history.subscribe((event) => {
  console.log(event.type, '→', event.to.location.pathname, event.to.state);
});

await history.push('/profile/42', { state: { view: 'profile', userId: '42' } });
history.back();
```

## Why a rewrite?

| Original `history.js` (2010)              | `@buildwithdarsh/history.js` (2026) |
| ----------------------------------------- | ----------------------------------- |
| HTML4 hashchange fallback                 | Native History API only             |
| jQuery / MooTools / Prototype adapters    | Zero dependencies                   |
| Global `History` namespace, untyped state | TypeScript-first, generic state     |
| Event-name strings (`statechange`)        | Typed `NavigationEvent` callbacks   |
| No navigation guards                      | Async guards with cancellation      |
| Manual query/hash building                | `setQuery`, `setHash`, `getQuery`   |
| No routing primitives                     | Built-in pattern matcher            |
| Manual `<a>` interception                 | `interceptLinks(history)`           |
| Manual scroll handling                    | Built-in scroll restoration         |

## Core concepts

### Entries

Every navigation produces a typed `HistoryEntry<TState>`:

```ts
{
  id: string;            // stable, survives reload
  state: TState | null;  // your typed state
  title: string;
  location: { pathname, search, hash, href, origin };
  index: number;         // monotonic
  timestamp: number;     // Date.now() at navigation
}
```

### Navigation

```ts
await history.push('/path', { state: {...}, title: 'New title' });
await history.replace('/path');
history.back();       // or history.back(2)
history.forward();
history.go(-3);
history.reload();
```

`push` and `replace` are async because guards may be async. They resolve to `true` if the navigation completed, `false` if it was cancelled.

### Listeners

```ts
const unsubscribe = history.subscribe((event) => {
  // event.type:      'push' | 'replace' | 'pop'
  // event.direction: 'forward' | 'backward' | 'none'
  // event.from / event.to: HistoryEntry
  // event.isPopState: true if triggered by browser back/forward
});

unsubscribe();
```

### Guards

Guards run before every navigation. Return `false` to cancel.

```ts
history.addGuard(async (event) => {
  if (event.to.location.pathname.startsWith('/admin')) {
    return await checkAuth();
  }
});

// Or just prompt the user:
history.block('You have unsaved changes — leave anyway?');
```

For pop navigations, a cancelled guard attempts to push the user back via `history.go(delta)`.

### Query helpers

```ts
history.setQuery({ page: 2, q: 'hello' });   // patch params
history.setQuery({ page: null });            // remove a key
history.getQuery('page');                    // '2'
history.searchParams;                        // URLSearchParams (read-only)
```

Or use the standalone helpers:

```ts
import { parseQuery, stringifyQuery, mergeQuery } from '@buildwithdarsh/history.js';
```

### Route matching

```ts
import { matchPattern, buildPath } from '@buildwithdarsh/history.js';

history.matches<{ id: string }>('/users/:id');
// → { pattern: '/users/:id', path: '/users/42', params: { id: '42' } }

buildPath('/users/:id', { id: 42 });
// → '/users/42'
```

Supported syntax:
- `:name` — named param, matches a single segment
- `:name?` — optional segment
- `:name*` — splat, matches the rest including slashes

### Link interception

One call hijacks every same-origin `<a>` click. Modifier-clicks, off-origin links, download links, and links with `target` pass through unchanged.

```ts
import { interceptLinks } from '@buildwithdarsh/history.js';

const off = interceptLinks(history);
// Optional config:
interceptLinks(history, {
  selector: 'a[data-spa]',
  root: document.getElementById('app'),
  sameOriginOnly: true,
});
```

### Virtual stack

`history.entries` is an in-memory snapshot of every entry the manager has visited — great for breadcrumbs, history menus, or analytics.

```ts
history.entries.forEach((entry) => {
  console.log(entry.index, entry.location.href, entry.timestamp);
});
```

### Metrics

```ts
history.metrics; // { pushes, replaces, pops, cancelled }
```

### Scroll restoration

Enabled by default on pop navigations. To opt out:

```ts
const history = getHistory({ restoreScrollOnPop: false });
```

The library sets `history.scrollRestoration = 'manual'` by default — pass `scrollRestoration: 'auto'` or `false` to opt out.

### Singleton vs. instance

`getHistory()` is a lazy singleton — convenient for app code. For tests or iframes, instantiate directly:

```ts
import { HistoryManager } from '@buildwithdarsh/history.js';
const history = new HistoryManager({ window: iframe.contentWindow! });
```

## React example

```tsx
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getHistory } from '@buildwithdarsh/history.js';

const history = getHistory<{ page: string }>();

export function useHistoryEntry() {
  return useSyncExternalStore(
    (cb) => history.subscribe(cb),
    () => history.entry,
  );
}
```

## Demo

A full live playground (the page in `example/index.html`) is deployed at the project URL — push, replace, back/forward, query patching, route matching, guards, link interception, virtual stack, and a real-time event log are all wired up.

To run locally:

```bash
npm install
npm run build
npx serve example
```

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # rollup → dist/
npm run dev         # rollup --watch
```

## Publishing

```bash
npm publish --access public
```

The `prepublishOnly` script runs typecheck, tests, and the rollup build.

## License

MIT
