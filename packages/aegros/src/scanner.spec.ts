import { describe, expect, it } from 'vitest';
import { createDefaultReportPath, jsonPathToMarkdownPath } from './scanner.js';

describe('scanner helpers', () => {
  it('creates json report path', () => {
    const path = createDefaultReportPath('reports');
    expect(path.endsWith('.json')).toBe(true);
    expect(path.includes('report-')).toBe(true);
  });

  it('maps json path to markdown sibling', () => {
    expect(jsonPathToMarkdownPath('/tmp/r.json')).toBe('/tmp/r.md');
  });
});
