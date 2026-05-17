import { describe, expect, it } from 'vitest';
import { buildPath, matchPattern } from '../src/matcher.js';

describe('route matcher', () => {
  it('matches a static path', () => {
    expect(matchPattern('/about', '/about')).toEqual({
      pattern: '/about',
      path: '/about',
      params: {},
    });
  });

  it('matches a single named param', () => {
    const m = matchPattern('/users/:id', '/users/42');
    expect(m?.params).toEqual({ id: '42' });
  });

  it('matches multiple named params', () => {
    const m = matchPattern('/teams/:team/users/:id', '/teams/foo/users/42');
    expect(m?.params).toEqual({ team: 'foo', id: '42' });
  });

  it('returns null for non-matches', () => {
    expect(matchPattern('/users/:id', '/posts/42')).toBeNull();
    expect(matchPattern('/users/:id', '/users/42/extra')).toBeNull();
  });

  it('supports optional segments', () => {
    expect(matchPattern('/posts/:slug?', '/posts')?.params).toEqual({});
    expect(matchPattern('/posts/:slug?', '/posts/hello')?.params).toEqual({ slug: 'hello' });
  });

  it('supports splat params', () => {
    expect(matchPattern('/files/:path*', '/files/a/b/c.txt')?.params).toEqual({
      path: 'a/b/c.txt',
    });
  });

  it('tolerates trailing slashes', () => {
    expect(matchPattern('/about', '/about/')).not.toBeNull();
  });

  it('decodes URI-encoded params', () => {
    const m = matchPattern('/users/:name', '/users/john%20doe');
    expect(m?.params.name).toBe('john doe');
  });

  it('buildPath substitutes params', () => {
    expect(buildPath('/users/:id', { id: 42 })).toBe('/users/42');
    expect(buildPath('/teams/:team/users/:id', { team: 'foo', id: 'bar' })).toBe(
      '/teams/foo/users/bar',
    );
  });

  it('buildPath encodes special characters', () => {
    expect(buildPath('/users/:name', { name: 'john doe' })).toBe('/users/john%20doe');
  });
});
