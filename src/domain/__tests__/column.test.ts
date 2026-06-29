import { describe, expect, it } from 'vitest';
import { defaultColumn, normalizeColumnParams } from '../kz/derive';

describe('column params', () => {
  it('uses rectangular columns by default', () => {
    expect(defaultColumn().sectionType).toBe('rect');
  });

  it('normalizes legacy circular column params to rectangular params', () => {
    const legacy = {
      ...defaultColumn(),
      sectionType: 'circle',
      D: 700,
      b: 500,
      h: 600,
    };

    const normalized = normalizeColumnParams(legacy);

    expect(normalized.sectionType).toBe('rect');
    expect(normalized.b).toBe(700);
    expect(normalized.h).toBe(700);
    expect('D' in normalized).toBe(false);
  });
});
