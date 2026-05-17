import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HistoryManager } from '../src/manager.js';
import { interceptLinks } from '../src/links.js';

describe('link interceptor', () => {
  let manager: HistoryManager;
  let teardown: () => void;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '';
    manager = new HistoryManager();
    teardown = interceptLinks(manager);
  });

  afterEach(() => {
    teardown();
    manager.destroy();
  });

  function clickAnchor(a: HTMLAnchorElement, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    a.dispatchEvent(event);
    return event;
  }

  it('intercepts same-origin link clicks', async () => {
    const a = document.createElement('a');
    a.href = '/intercepted';
    document.body.appendChild(a);
    const event = clickAnchor(a);
    // Allow the async push to flush.
    await Promise.resolve();
    expect(event.defaultPrevented).toBe(true);
    expect(manager.entry.location.pathname).toBe('/intercepted');
  });

  it('lets modifier-clicks through to the browser', () => {
    const a = document.createElement('a');
    a.href = '/modified';
    document.body.appendChild(a);
    const event = clickAnchor(a, { metaKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(manager.entry.location.pathname).toBe('/');
  });

  it('skips anchors with target="_blank"', () => {
    const a = document.createElement('a');
    a.href = '/external';
    a.target = '_blank';
    document.body.appendChild(a);
    const event = clickAnchor(a);
    expect(event.defaultPrevented).toBe(false);
  });

  it('skips download links', () => {
    const a = document.createElement('a');
    a.href = '/file.pdf';
    a.setAttribute('download', '');
    document.body.appendChild(a);
    const event = clickAnchor(a);
    expect(event.defaultPrevented).toBe(false);
  });

  it('skips mailto/tel/javascript schemes', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'mailto:hi@example.com');
    document.body.appendChild(a);
    const event = clickAnchor(a);
    expect(event.defaultPrevented).toBe(false);
  });
});
