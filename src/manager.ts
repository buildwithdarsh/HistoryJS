import { matchPattern } from './matcher.js';
import { mergeQuery } from './query.js';
import type {
  HistoryEntry,
  HistoryManagerOptions,
  Listener,
  NavigateOptions,
  NavigationDirection,
  NavigationEvent,
  NavigationGuard,
  NavigationType,
  QueryInput,
  RouteMatch,
  Unsubscribe,
} from './types.js';
import {
  locationOf,
  makeId,
  parseLocation,
  resolveUrl,
  unwrapState,
  wrapState,
} from './utils.js';

export class HistoryManager<TState = unknown> {
  /** @internal — exposed for the link interceptor. Do not rely on this. */
  readonly _win: Window;
  private readonly history: History;
  private readonly listeners = new Set<Listener<TState>>();
  private readonly guards = new Set<NavigationGuard<TState>>();
  private readonly restoreScrollOnPop: boolean;
  private readonly maxStackSize: number;

  private stack: HistoryEntry<TState>[] = [];
  private current: HistoryEntry<TState>;
  private indexCounter = 0;
  private destroyed = false;
  private readonly onPopState: (e: PopStateEvent) => void;

  /** Cumulative counts since construction — useful for live demos and debugging. */
  readonly metrics = {
    pushes: 0,
    replaces: 0,
    pops: 0,
    cancelled: 0,
  };

  constructor(options: HistoryManagerOptions = {}) {
    const win =
      options.window ?? (typeof window !== 'undefined' ? window : undefined);
    if (!win) {
      throw new Error(
        'HistoryManager requires a window. Pass `options.window` when running outside the browser.',
      );
    }
    this._win = win;
    this.history = win.history;
    this.restoreScrollOnPop = options.restoreScrollOnPop ?? true;
    this.maxStackSize = options.maxStackSize ?? 100;

    if (options.scrollRestoration !== false && 'scrollRestoration' in win.history) {
      this.history.scrollRestoration = options.scrollRestoration ?? 'manual';
    }

    this.current = this.adoptOrCreateInitialEntry();
    this.stack.push(this.current);

    this.onPopState = (event: PopStateEvent) => {
      void this.handlePop(event);
    };
    this._win.addEventListener('popstate', this.onPopState);
  }

  // -----------------------------------------------------------------------
  // Read-only accessors
  // -----------------------------------------------------------------------

  /** The currently active entry. */
  get entry(): HistoryEntry<TState> {
    return this.current;
  }

  /** Current application state — shorthand for `manager.entry.state`. */
  get state(): TState | null {
    return this.current.state;
  }

  /** Current location object. */
  get location() {
    return this.current.location;
  }

  /** Total entries in the session history (delegates to `window.history.length`). */
  get length(): number {
    return this.history.length;
  }

  /** Snapshot of the in-memory entry stack, oldest first. */
  get entries(): readonly HistoryEntry<TState>[] {
    return this.stack;
  }

  /** True if we believe we can move back in history. Best-effort. */
  get canGoBack(): boolean {
    return this.current.index > 0;
  }

  // -----------------------------------------------------------------------
  // Subscribe / guard
  // -----------------------------------------------------------------------

  /** Subscribe to navigation events. Returns an unsubscribe function. */
  subscribe(listener: Listener<TState>): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Register a navigation guard. Return `false` to cancel a navigation.
   * Guards run for push, replace, and pop. For pop, a cancelled guard will
   * attempt to restore the previous URL via `history.go`.
   */
  addGuard(guard: NavigationGuard<TState>): Unsubscribe {
    this.guards.add(guard);
    return () => {
      this.guards.delete(guard);
    };
  }

  /**
   * Convenience: confirm-prompt blocker. Returns a teardown function.
   * Pass a string for `window.confirm`, or a function returning a string/boolean/Promise.
   */
  block(
    message: string | ((event: NavigationEvent<TState>) => string | boolean | Promise<string | boolean>),
  ): Unsubscribe {
    return this.addGuard(async (event) => {
      const resolved = typeof message === 'function' ? await message(event) : message;
      if (resolved === false) return false;
      if (resolved === true) return true;
      // String prompt — ask the user.
      return this._win.confirm(resolved);
    });
  }

  /** Resolve a promise on the next navigation event. */
  waitFor(): Promise<NavigationEvent<TState>> {
    return new Promise((resolve) => {
      const off = this.subscribe((event) => {
        off();
        resolve(event);
      });
    });
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /** Push a new entry. */
  push(url: string | URL, options: NavigateOptions<TState> = {}): Promise<boolean> {
    return this.navigate(url, { ...options, replace: false });
  }

  /** Replace the current entry. */
  replace(url: string | URL, options: NavigateOptions<TState> = {}): Promise<boolean> {
    return this.navigate(url, { ...options, replace: true });
  }

  /** Go back N entries. */
  back(n = 1): void {
    this.history.go(-Math.abs(n));
  }

  /** Go forward N entries. */
  forward(n = 1): void {
    this.history.go(Math.abs(n));
  }

  /** Jump by a signed delta — negative = back, positive = forward. */
  go(delta: number): void {
    this.history.go(delta);
  }

  /** Reload the current URL (full page reload). */
  reload(): void {
    this._win.location.reload();
  }

  /**
   * Update state on the current entry in place without changing the URL.
   */
  updateState(updater: TState | ((prev: TState | null) => TState | null)): void {
    const next =
      typeof updater === 'function'
        ? (updater as (prev: TState | null) => TState | null)(this.current.state)
        : updater;
    this.current = { ...this.current, state: next ?? null };
    this.writeRaw(this.current, true);
  }

  // -----------------------------------------------------------------------
  // Query / hash helpers
  // -----------------------------------------------------------------------

  /** Current query string parsed into a URLSearchParams (read-only — clone before mutating). */
  get searchParams(): URLSearchParams {
    return new URLSearchParams(this.current.location.search);
  }

  /** Read a single query value from the current URL. */
  getQuery(key: string): string | null {
    return this.searchParams.get(key);
  }

  /**
   * Replace-navigate to the same path with a patched query string.
   * `undefined` and `null` values remove the key.
   */
  setQuery(patch: QueryInput, options: NavigateOptions<TState> = {}): Promise<boolean> {
    const nextSearch = mergeQuery(this.current.location.search, patch);
    const href = this.current.location.pathname + nextSearch + this.current.location.hash;
    return this.replace(href, options);
  }

  /** Replace-navigate to the same path with the hash updated. */
  setHash(hash: string, options: NavigateOptions<TState> = {}): Promise<boolean> {
    const normalized = hash === '' || hash.startsWith('#') ? hash : `#${hash}`;
    const href = this.current.location.pathname + this.current.location.search + normalized;
    return this.replace(href, options);
  }

  // -----------------------------------------------------------------------
  // Route matching
  // -----------------------------------------------------------------------

  /** Match the current pathname against a route pattern. */
  matches<TParams extends Record<string, string> = Record<string, string>>(
    pattern: string,
  ): RouteMatch<TParams> | null {
    return matchPattern<TParams>(pattern, this.current.location.pathname);
  }

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------

  /** Tear down listeners. Call when your app unmounts. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this._win.removeEventListener('popstate', this.onPopState);
    this.listeners.clear();
    this.guards.clear();
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private adoptOrCreateInitialEntry(): HistoryEntry<TState> {
    const raw = this.history.state;
    const { user, meta } = unwrapState<TState>(raw);

    const index = meta?.index ?? this.indexCounter;
    this.indexCounter = index + 1;
    const id = meta?.id ?? makeId();

    const entry: HistoryEntry<TState> = {
      id,
      state: user,
      title: this._win.document.title,
      location: locationOf(this._win),
      index,
      timestamp: Date.now(),
    };

    if (!meta) {
      this.writeRaw(entry, true);
    }
    return entry;
  }

  private writeRaw(entry: HistoryEntry<TState>, replace: boolean): void {
    const wrapped = wrapState(entry.state, {
      id: entry.id,
      index: entry.index,
      scroll: { x: this._win.scrollX, y: this._win.scrollY },
    });
    const method = replace ? 'replaceState' : 'pushState';
    this.history[method](wrapped, entry.title, entry.location.href);
  }

  private async runGuards(event: NavigationEvent<TState>): Promise<boolean> {
    for (const guard of Array.from(this.guards)) {
      const result = await guard(event);
      if (result === false) return false;
    }
    return true;
  }

  private emit(event: NavigationEvent<TState>): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch (err) {
        // Listener errors should never break navigation.
        // eslint-disable-next-line no-console
        console.error('[history.js] listener threw:', err);
      }
    }
  }

  private pushToStack(entry: HistoryEntry<TState>, replace: boolean): void {
    if (replace) {
      this.stack[this.stack.length - 1] = entry;
      return;
    }
    this.stack.push(entry);
    if (this.stack.length > this.maxStackSize) {
      this.stack.splice(0, this.stack.length - this.maxStackSize);
    }
  }

  private async navigate(
    url: string | URL,
    options: NavigateOptions<TState>,
  ): Promise<boolean> {
    const replace = options.replace ?? false;
    const href = resolveUrl(url, this._win.location.href);
    const title = options.title ?? this._win.document.title;

    const nextIndex = replace ? this.current.index : this.indexCounter + 1;
    const next: HistoryEntry<TState> = {
      id: makeId(),
      state: options.state ?? null,
      title,
      location: parseLocation(href),
      index: nextIndex,
      timestamp: Date.now(),
    };

    const event: NavigationEvent<TState> = {
      type: replace ? ('replace' satisfies NavigationType) : ('push' satisfies NavigationType),
      direction: 'none',
      from: this.current,
      to: next,
      isPopState: false,
    };

    if (!options.force) {
      const ok = await this.runGuards(event);
      if (!ok) {
        this.metrics.cancelled += 1;
        return false;
      }
    }

    this.indexCounter = nextIndex;
    this.current = next;
    if (title && this._win.document.title !== title) {
      this._win.document.title = title;
    }
    this.writeRaw(next, replace);
    this.pushToStack(next, replace);

    if (replace) this.metrics.replaces += 1;
    else this.metrics.pushes += 1;

    const shouldScroll = options.scrollToTop ?? !replace;
    if (shouldScroll && typeof this._win.scrollTo === 'function') {
      this._win.scrollTo(0, 0);
    }

    this.emit(event);
    return true;
  }

  private async handlePop(rawEvent: PopStateEvent): Promise<void> {
    const { user, meta } = unwrapState<TState>(rawEvent.state);
    const prevIndex = this.current.index;
    const nextIndex = meta?.index ?? prevIndex;
    const direction: NavigationDirection =
      nextIndex > prevIndex ? 'forward' : nextIndex < prevIndex ? 'backward' : 'none';

    const next: HistoryEntry<TState> = {
      id: meta?.id ?? makeId(),
      state: user,
      title: this._win.document.title,
      location: locationOf(this._win),
      index: nextIndex,
      timestamp: Date.now(),
    };

    const event: NavigationEvent<TState> = {
      type: 'pop',
      direction,
      from: this.current,
      to: next,
      isPopState: true,
    };

    const ok = await this.runGuards(event);
    if (!ok) {
      this.metrics.cancelled += 1;
      const delta = prevIndex - nextIndex;
      if (delta !== 0) this.history.go(delta);
      return;
    }

    this.current = next;
    this.indexCounter = Math.max(this.indexCounter, nextIndex);
    this.metrics.pops += 1;

    if (this.restoreScrollOnPop && meta?.scroll) {
      this._win.scrollTo(meta.scroll.x, meta.scroll.y);
    }
    this.emit(event);
  }
}
