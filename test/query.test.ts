import { describe, expect, it } from 'vitest';
import {
  getQueryValue,
  hasQueryKey,
  mergeQuery,
  parseQuery,
  stringifyQuery,
} from '../src/query.js';

describe('query helpers', () => {
  it('parses a query string into an object', () => {
    expect(parseQuery('?a=1&b=two')).toEqual({ a: '1', b: 'two' });
  });

  it('groups repeated keys into an array', () => {
    expect(parseQuery('?tag=a&tag=b&tag=c')).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('stringifies primitives', () => {
    expect(stringifyQuery({ q: 'hi', page: 2, on: true })).toBe('?q=hi&page=2&on=true');
  });

  it('stringifies arrays as repeated keys', () => {
    expect(stringifyQuery({ tag: ['a', 'b'] })).toBe('?tag=a&tag=b');
  });

  it('skips null and undefined values', () => {
    expect(stringifyQuery({ a: 1, b: null, c: undefined })).toBe('?a=1');
  });

  it('returns empty string for empty input', () => {
    expect(stringifyQuery({})).toBe('');
  });

  it('mergeQuery overrides and deletes keys', () => {
    expect(mergeQuery('?a=1&b=2', { b: 3 })).toBe('?a=1&b=3');
    expect(mergeQuery('?a=1&b=2', { a: null })).toBe('?b=2');
  });

  it('mergeQuery replaces repeated keys with arrays', () => {
    expect(mergeQuery('?tag=a&tag=b', { tag: ['x', 'y'] })).toBe('?tag=x&tag=y');
  });

  it('getQueryValue and hasQueryKey work without leading ?', () => {
    expect(getQueryValue('a=1', 'a')).toBe('1');
    expect(hasQueryKey('a=1', 'b')).toBe(false);
  });
});
