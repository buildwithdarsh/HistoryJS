export { HistoryManager } from './manager.js';
export { interceptLinks } from './links.js';
export {
  matchPattern,
  compilePattern,
  buildPath,
} from './matcher.js';
export {
  parseQuery,
  stringifyQuery,
  mergeQuery,
  getQueryValue,
  hasQueryKey,
} from './query.js';

export type {
  HistoryEntry,
  HistoryLocation,
  HistoryManagerOptions,
  LinkInterceptorOptions,
  Listener,
  NavigateOptions,
  NavigationDirection,
  NavigationEvent,
  NavigationGuard,
  NavigationType,
  QueryInput,
  QueryValue,
  RouteMatch,
  Unsubscribe,
} from './types.js';

import { HistoryManager } from './manager.js';
import type { HistoryManagerOptions } from './types.js';

let singleton: HistoryManager<unknown> | null = null;

/**
 * Lazy singleton — convenient for app code that just wants "the" history.
 * Pass options the first time to configure. Subsequent calls ignore options.
 * Use `new HistoryManager()` directly if you need multiple instances.
 */
export function getHistory<TState = unknown>(
  options?: HistoryManagerOptions,
): HistoryManager<TState> {
  if (!singleton) {
    singleton = new HistoryManager<unknown>(options);
  }
  return singleton as unknown as HistoryManager<TState>;
}

/** Reset the singleton — primarily for tests. */
export function resetHistorySingleton(): void {
  singleton?.destroy();
  singleton = null;
}

/** Default export — the same `getHistory` used as a callable, with helpers attached. */
const defaultExport = Object.assign(getHistory, {
  HistoryManager,
  getHistory,
  resetHistorySingleton,
});

export default defaultExport;
