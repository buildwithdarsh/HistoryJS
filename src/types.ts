export type NavigationType = 'push' | 'replace' | 'pop';

export type NavigationDirection = 'forward' | 'backward' | 'none';

export interface HistoryLocation {
  pathname: string;
  search: string;
  hash: string;
  href: string;
  origin: string;
}

export interface HistoryEntry<TState = unknown> {
  /** Stable id assigned per entry — survives reload of the same entry. */
  id: string;
  /** Application state attached to the entry. */
  state: TState | null;
  /** Document title at the time of navigation. */
  title: string;
  /** Snapshot of the URL parts. */
  location: HistoryLocation;
  /** Monotonic index relative to library initialization (best-effort). */
  index: number;
  /** Wall-clock timestamp the entry was visited. */
  timestamp: number;
}

export interface NavigationEvent<TState = unknown> {
  type: NavigationType;
  direction: NavigationDirection;
  from: HistoryEntry<TState> | null;
  to: HistoryEntry<TState>;
  /** Truthy when triggered by browser back/forward, false for programmatic. */
  isPopState: boolean;
}

export type Listener<TState = unknown> = (event: NavigationEvent<TState>) => void;

export type Unsubscribe = () => void;

/** Return false (or a Promise resolving to false) to cancel a navigation. */
export type NavigationGuard<TState = unknown> = (
  event: NavigationEvent<TState>,
) => boolean | void | Promise<boolean | void>;

export interface NavigateOptions<TState = unknown> {
  state?: TState | null;
  title?: string;
  /** Use replaceState instead of pushState. */
  replace?: boolean;
  /** Skip guards — useful for programmatic redirects from inside a guard. */
  force?: boolean;
  /** Scroll to top after navigation. Default: true for push, false for replace. */
  scrollToTop?: boolean;
}

export interface HistoryManagerOptions {
  /** Override window — useful for testing or iframe scenarios. */
  window?: Window;
  /** Control native `history.scrollRestoration`. Defaults to 'manual'. */
  scrollRestoration?: 'auto' | 'manual' | false;
  /** Restore scroll position on pop navigations. Defaults to true. */
  restoreScrollOnPop?: boolean;
  /** Max entries to retain in the in-memory stack. Defaults to 100. */
  maxStackSize?: number;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryInput = Record<string, QueryValue | QueryValue[]>;

export interface RouteMatch<TParams extends Record<string, string> = Record<string, string>> {
  pattern: string;
  path: string;
  params: TParams;
}

export interface LinkInterceptorOptions {
  /** CSS selector to limit which anchors are intercepted. Default: 'a[href]'. */
  selector?: string;
  /** Root element to attach the listener to. Default: document. */
  root?: Document | HTMLElement;
  /** Skip anchors whose `target` is set (e.g. _blank). Default: true. */
  respectTarget?: boolean;
  /** Skip anchors that point off-origin. Default: true. */
  sameOriginOnly?: boolean;
  /** Skip download links. Default: true. */
  skipDownloads?: boolean;
}
