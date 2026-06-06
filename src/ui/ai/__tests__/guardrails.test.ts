import { describe, expect, it } from 'vitest';
import { MAX_INPUT_CHARS, selectHistoryForModel, validateUserMessage } from '../guardrails';

describe('validateUserMessage', () => {
  it('requires an API key before sending', () => {
    expect(validateUserMessage('N4C16 是什么意思', '').error).toBe('请先配置当前模型的 API Key，再发送问题。');
  });

  it('truncates long input', () => {
    const result = validateUserMessage('梁'.repeat(MAX_INPUT_CHARS + 20), 'sk-test');
    expect(result.ok).toBe(true);
    expect(result.text).toHaveLength(MAX_INPUT_CHARS);
  });

  it('warns for likely out-of-domain questions', () => {
    const result = validateUserMessage('今天上海天气怎么样', 'sk-test');
    expect(result.ok).toBe(true);
    expect(result.warning).toContain('超出平法范围');
  });
});

describe('selectHistoryForModel', () => {
  it('keeps only recent non-empty messages', () => {
    const history = Array.from({ length: 25 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: index === 2 ? '  ' : `message-${index}`,
    }));
    const selected = selectHistoryForModel(history, 10);
    expect(selected).toHaveLength(10);
    expect(selected[0].content).toBe('message-15');
    expect(selected[selected.length - 1]?.content).toBe('message-24');
  });
});
