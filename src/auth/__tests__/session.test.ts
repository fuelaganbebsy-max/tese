import { describe, expect, it } from 'vitest';
import { dayKey, makeSession, validateSession } from '../session';

describe('dayKey', () => {
  it('formats local date as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 5, 22))).toBe('2026-06-22');
    expect(dayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('makeSession', () => {
  it('stamps the session with the calendar day', () => {
    const s = makeSession({ id: 's1', name: '示例大学' }, '张三', new Date(2026, 5, 22));
    expect(s).toEqual({ day: '2026-06-22', school: { id: 's1', name: '示例大学' }, name: '张三' });
  });
});

describe('validateSession', () => {
  const today = '2026-06-22';
  const valid = { day: today, school: { id: 's1', name: '示例大学' }, name: '张三' };

  it('accepts a well-formed session for today', () => {
    expect(validateSession(valid, today)).toEqual(valid);
  });

  it('rejects a session from a previous day', () => {
    expect(validateSession({ ...valid, day: '2026-06-21' }, today)).toBeNull();
  });

  it('rejects malformed sessions', () => {
    expect(validateSession(null, today)).toBeNull();
    expect(validateSession({ day: today, name: '张三' }, today)).toBeNull();
    expect(validateSession({ day: today, school: { id: 's1', name: '' }, name: '张三' }, today)).toBeNull();
    expect(validateSession({ day: today, school: { id: 's1', name: 'x' }, name: '' }, today)).toBeNull();
  });
});
