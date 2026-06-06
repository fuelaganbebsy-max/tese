import { describe, expect, it } from 'vitest';
import { deepseekProvider } from '../providers/deepseek';

describe('deepseek provider metadata', () => {
  it('uses the modern flash model by default', () => {
    expect(deepseekProvider.config.defaultModel).toBe('deepseek-v4-flash');
  });

  it('keeps deprecated legacy models visible but not recommended', () => {
    const legacy = deepseekProvider.config.models.filter((model) => model.status === 'deprecated');
    expect(legacy.map((model) => model.id)).toEqual(expect.arrayContaining(['deepseek-chat', 'deepseek-reasoner']));
  });
});
