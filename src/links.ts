import type { HistoryManager } from './manager.js';
import type { LinkInterceptorOptions, Unsubscribe } from './types.js';

/**
 * Intercept clicks on `<a>` elements and route them through the HistoryManager.
 * Modifier-clicks (cmd/ctrl/shift/alt), middle/right clicks, off-origin links,
 * download links, and links with a `target` are passed through to the browser.
 */
export function interceptLinks(
  history: HistoryManager,
  options: LinkInterceptorOptions = {},
): Unsubscribe {
  const win = getWindow(history);
  const doc = win.document;
  const root: Document | HTMLElement = options.root ?? doc;
  const selector = options.selector ?? 'a[href]';
  const respectTarget = options.respectTarget ?? true;
  const sameOriginOnly = options.sameOriginOnly ?? true;
  const skipDownloads = options.skipDownloads ?? true;

  const onClick = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.defaultPrevented) return;
    if (mouse.button !== undefined && mouse.button !== 0) return;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;

    const target = event.target as Element | null;
    if (!target || !target.closest) return;
    const anchor = target.closest(selector) as HTMLAnchorElement | null;
    if (!anchor) return;
    if (respectTarget && anchor.target && anchor.target !== '_self') return;
    if (skipDownloads && anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (!href) return;
    // Skip non-http schemes (mailto:, tel:, javascript:, etc).
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) return;

    const url = new URL(anchor.href, win.location.href);
    if (sameOriginOnly && url.origin !== win.location.origin) return;

    event.preventDefault();
    void history.push(url.pathname + url.search + url.hash);
  };

  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}

function getWindow(history: HistoryManager): Window {
  // HistoryManager keeps the window internally; we expose it via a hidden getter to avoid leaking it in the public API.
  return (history as unknown as { _win: Window })._win;
}
