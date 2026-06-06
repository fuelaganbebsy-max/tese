import { describe, expect, it } from 'vitest';
import { extractOpenAiDelta, parseSseEvents } from '../providers/sse';

describe('parseSseEvents', () => {
  it('parses complete SSE events and keeps partial rest', () => {
    const input = 'data: {"a":1}\n\n:data keepalive\n\ndata: {"b":2}\n';
    const result = parseSseEvents(input);
    expect(result.events).toEqual([{ data: '{"a":1}' }]);
    expect(result.rest).toBe('data: {"b":2}\n');
  });

  it('supports CRLF and multiline data', () => {
    const input = 'data: hello\r\ndata: world\r\n\r\n';
    const result = parseSseEvents(input);
    expect(result.events).toEqual([{ data: 'hello\nworld' }]);
    expect(result.rest).toBe('');
  });
});

describe('extractOpenAiDelta', () => {
  it('extracts text delta from OpenAI-compatible payloads', () => {
    const payload = JSON.stringify({ choices: [{ delta: { content: '你好' } }] });
    expect(extractOpenAiDelta(payload)).toBe('你好');
  });

  it('ignores done marker', () => {
    expect(extractOpenAiDelta('[DONE]')).toBe('');
  });
});
