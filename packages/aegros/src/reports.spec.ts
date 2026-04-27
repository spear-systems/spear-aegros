import { describe, expect, it } from 'vitest';
import { getReportsIndexPath } from './reports.js';

describe('reports paths', () => {
  it('index path ends with index.jsonl', () => {
    expect(getReportsIndexPath().endsWith('index.jsonl')).toBe(true);
  });
});
