import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mapSchools, handler } from '../schools';

describe('mapSchools', () => {
  it('keeps id/name and drops malformed rows', () => {
    const rows = [
      { id: 's1', name: '示例大学', is_active: true },
      { id: 's2', name: '' },
      'garbage',
      null,
    ];
    expect(mapSchools(rows)).toEqual([{ id: 's1', name: '示例大学' }]);
  });
});

describe('schools handler', () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns 405 for non-GET requests', async () => {
    const res = await handler({ httpMethod: 'POST' });
    expect(res.statusCode).toBe(405);
  });

  it('returns 500 without leaking key names when env is missing', async () => {
    const res = await handler({ httpMethod: 'GET' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('SUPABASE');
  });
});
