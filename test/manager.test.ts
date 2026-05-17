import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryManager } from '../src/manager.js';
import type { NavigationEvent } from '../src/types.js';

describe('HistoryManager', () => {
  let manager: HistoryManager<{ page?: string }>;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    manager = new HistoryManager<{ page?: string }>();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('captures the initial entry', () => {
    expect(manager.entry.location.pathname).toBe('/');
    expect(manager.state).toBeNull();
    expect(manager.entry.id).toMatch(/^hjs_/);
    expect(manager.entries).toHaveLength(1);
  });

  it('pushes a new entry and updates location', async () => {
    const ok = await manager.push('/about', { state: { page: 'about' } });
    expect(ok).toBe(true);
    expect(manager.entry.location.pathname).toBe('/about');
    expect(manager.state).toEqual({ page: 'about' });
    expect(manager.entries).toHaveLength(2);
  });

  it('replaces an entry without changing the index', async () => {
    await manager.push('/a');
    const beforeIndex = manager.entry.index;
    const beforeCount = manager.entries.length;
    await manager.replace('/b', { state: { page: 'b' } });
    expect(manager.entry.index).toBe(beforeIndex);
    expect(manager.entries.length).toBe(beforeCount);
    expect(manager.entry.location.pathname).toBe('/b');
    expect(manager.state).toEqual({ page: 'b' });
  });

  it('emits events to subscribers', async () => {
    const events: NavigationEvent<{ page?: string }>[] = [];
    manager.subscribe((e) => events.push(e));

    await manager.push('/one');
    await manager.replace('/one-b');

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('push');
    expect(events[0].to.location.pathname).toBe('/one');
    expect(events[1].type).toBe('replace');
    expect(events[1].to.location.pathname).toBe('/one-b');
  });

  it('unsubscribes cleanly', async () => {
    const fn = vi.fn();
    const off = manager.subscribe(fn);
    await manager.push('/x');
    off();
    await manager.push('/y');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels navigation when a guard returns false', async () => {
    manager.addGuard(() => false);
    const fn = vi.fn();
    manager.subscribe(fn);

    const ok = await manager.push('/blocked');
    expect(ok).toBe(false);
    expect(manager.entry.location.pathname).toBe('/');
    expect(fn).not.toHaveBeenCalled();
    expect(manager.metrics.cancelled).toBe(1);
  });

  it('allows navigation when force: true', async () => {
    manager.addGuard(() => false);
    const ok = await manager.push('/forced', { force: true });
    expect(ok).toBe(true);
    expect(manager.entry.location.pathname).toBe('/forced');
  });

  it('updateState mutates state without navigation', async () => {
    await manager.push('/profile', { state: { page: 'profile' } });
    const before = manager.entry.location.pathname;
    manager.updateState((prev) => ({ ...prev, page: 'updated' }));
    expect(manager.entry.location.pathname).toBe(before);
    expect(manager.state).toEqual({ page: 'updated' });
  });

  it('updates the document title when provided', async () => {
    await manager.push('/titled', { title: 'My Title' });
    expect(document.title).toBe('My Title');
    expect(manager.entry.title).toBe('My Title');
  });

  it('resolves relative URLs against the current location', async () => {
    await manager.push('/parent/');
    await manager.push('child');
    expect(manager.entry.location.pathname).toBe('/parent/child');
  });

  it('destroy detaches the popstate listener', async () => {
    const fn = vi.fn();
    manager.subscribe(fn);
    manager.destroy();
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(fn).not.toHaveBeenCalled();
  });

  it('tracks metrics', async () => {
    await manager.push('/a');
    await manager.push('/b');
    await manager.replace('/b2');
    expect(manager.metrics.pushes).toBe(2);
    expect(manager.metrics.replaces).toBe(1);
  });

  it('matches a route pattern via .matches()', async () => {
    await manager.push('/users/42');
    const m = manager.matches<{ id: string }>('/users/:id');
    expect(m).not.toBeNull();
    expect(m!.params.id).toBe('42');
  });

  it('returns null when the pattern does not match', async () => {
    await manager.push('/posts');
    expect(manager.matches('/users/:id')).toBeNull();
  });

  it('setQuery merges params', async () => {
    await manager.push('/search?q=hi');
    await manager.setQuery({ page: 2, q: 'hello' });
    expect(manager.entry.location.search).toBe('?q=hello&page=2');
    expect(manager.getQuery('page')).toBe('2');
  });

  it('setQuery removes keys on null', async () => {
    await manager.push('/search?q=hi&page=2');
    await manager.setQuery({ page: null });
    expect(manager.entry.location.search).toBe('?q=hi');
  });

  it('setHash updates the hash without leaving the page', async () => {
    await manager.push('/doc');
    await manager.setHash('section-2');
    expect(manager.entry.location.hash).toBe('#section-2');
  });

  it('waitFor resolves on the next navigation', async () => {
    const promise = manager.waitFor();
    void manager.push('/awaited');
    const event = await promise;
    expect(event.to.location.pathname).toBe('/awaited');
  });
});
