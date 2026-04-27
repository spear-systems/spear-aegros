import { describe, expect, it } from 'vitest';
import {
  createDefaultReportPath,
  detectEmailProvider,
  jsonPathToMarkdownPath,
  policyAllows,
} from './scanner.js';

describe('scanner helpers', () => {
  it('creates json report path', () => {
    const path = createDefaultReportPath('reports');
    expect(path.endsWith('.json')).toBe(true);
    expect(path.includes('report-')).toBe(true);
  });

  it('maps json path to markdown sibling', () => {
    expect(jsonPathToMarkdownPath('/tmp/r.json')).toBe('/tmp/r.md');
  });

  it('enforces centralized policy gates', () => {
    expect(policyAllows('passive', 'passive')).toBe(true);
    expect(policyAllows('passive', 'standard')).toBe(false);
    expect(policyAllows('passive', 'aggressive')).toBe(false);

    expect(policyAllows('standard', 'passive')).toBe(true);
    expect(policyAllows('standard', 'standard')).toBe(true);
    expect(policyAllows('standard', 'aggressive')).toBe(false);

    expect(policyAllows('aggressive', 'passive')).toBe(true);
    expect(policyAllows('aggressive', 'standard')).toBe(true);
    expect(policyAllows('aggressive', 'aggressive')).toBe(true);
  });

  it('detects common email providers from mx hosts', () => {
    expect(detectEmailProvider(['aspmx.l.google.com'])).toBe('google-workspace');
    expect(detectEmailProvider(['mx1.protection.outlook.com'])).toBe('microsoft-365');
    expect(detectEmailProvider(['mx.unknown-provider.example'])).toBeUndefined();
  });
});
