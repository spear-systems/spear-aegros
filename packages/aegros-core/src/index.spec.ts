import { describe, expect, it } from 'vitest';
import { AEGROS_CORE_VERSION } from './index';

describe('aegros-core', () => {
  it('exports version', () => {
    expect(AEGROS_CORE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
