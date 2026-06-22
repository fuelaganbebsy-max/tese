import { describe, expect, it } from 'vitest';
import { parseLoginBody, buildAllowedUsersQuery, evaluateMatch } from '../login';

describe('parseLoginBody', () => {
  it('trims and accepts complete payloads', () => {
    expect(parseLoginBody({ schoolId: ' s1 ', name: ' 张三 ', identityCode: ' 2024 ' })).toEqual({
      schoolId: 's1',
      name: '张三',
      identityCode: '2024',
    });
  });

  it('rejects empty or missing fields', () => {
    expect(parseLoginBody({ schoolId: '', name: 'a', identityCode: 'b' })).toBeNull();
    expect(parseLoginBody({ schoolId: 's', name: '   ', identityCode: 'b' })).toBeNull();
    expect(parseLoginBody({ schoolId: 's', name: 'a' })).toBeNull();
  });

  it('rejects non-object input', () => {
    expect(parseLoginBody(null)).toBeNull();
    expect(parseLoginBody('nope')).toBeNull();
  });
});

describe('buildAllowedUsersQuery', () => {
  it('encodes the three matching filters and active flag', () => {
    const q = buildAllowedUsersQuery({ schoolId: 's1', name: '张三', identityCode: '20+24' });
    expect(q).toContain('school_id=eq.s1');
    expect(q).toContain(`name=eq.${encodeURIComponent('张三')}`);
    expect(q).toContain('identity_code=eq.20%2B24');
    expect(q).toContain('is_active=eq.true');
    expect(q).toContain('limit=1');
  });
});

describe('evaluateMatch', () => {
  const input = { schoolId: 's1', name: '张三', identityCode: '2024' };

  it('passes when user matches an active school', () => {
    const rows = [
      { id: 'u1', name: '张三', identity_code: '2024', school_id: 's1', schools: { id: 's1', name: '示例大学', is_active: true } },
    ];
    expect(evaluateMatch(rows, input)).toEqual({
      ok: true,
      school: { id: 's1', name: '示例大学' },
      name: '张三',
    });
  });

  it('fails when no rows returned', () => {
    expect(evaluateMatch([], input)).toBeNull();
  });

  it('fails when the school is inactive', () => {
    const rows = [{ schools: { id: 's1', name: '示例大学', is_active: false } }];
    expect(evaluateMatch(rows, input)).toBeNull();
  });

  it('fails when the school relation is missing', () => {
    expect(evaluateMatch([{ id: 'u1' }], input)).toBeNull();
  });
});
