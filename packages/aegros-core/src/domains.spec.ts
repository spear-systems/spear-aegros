import { describe, expect, it } from 'vitest';
import { normalizeDomainLabel, normalizeDomainsToScope } from './domains.js';

describe('normalizeDomainLabel', () => {
  it('trims and lowercases', () => {
    expect(normalizeDomainLabel('  Example.COM ')).toBe('example.com');
  });
});

describe('normalizeDomainsToScope', () => {
  it('dedupes preserving order', () => {
    expect(normalizeDomainsToScope(['a.com', 'A.COM', 'b.com'])).toEqual(['a.com', 'b.com']);
  });
});
