import { describe, expect, it, vi } from 'vitest';
import {
  credentialsComplete,
  normalizeCredentials,
  fetchSchools,
  login,
} from '../api';

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('credential helpers', () => {
  it('normalizes by trimming', () => {
    expect(normalizeCredentials({ schoolId: ' s ', name: ' 张三 ', identityCode: ' 1 ' })).toEqual({
      schoolId: 's',
      name: '张三',
      identityCode: '1',
    });
  });

  it('credentialsComplete requires all three fields', () => {
    expect(credentialsComplete({ schoolId: 's', name: 'a', identityCode: 'b' })).toBe(true);
    expect(credentialsComplete({ schoolId: ' ', name: 'a', identityCode: 'b' })).toBe(false);
    expect(credentialsComplete({ schoolId: 's', name: '', identityCode: 'b' })).toBe(false);
  });
});

describe('fetchSchools', () => {
  it('returns the schools array on success', async () => {
    const f = vi.fn().mockResolvedValue(mockResponse(200, { schools: [{ id: 's1', name: 'A' }] }));
    await expect(fetchSchools(f)).resolves.toEqual([{ id: 's1', name: 'A' }]);
  });

  it('throws when the request fails', async () => {
    const f = vi.fn().mockResolvedValue(mockResponse(500, {}));
    await expect(fetchSchools(f)).rejects.toThrow();
  });
});

describe('login', () => {
  const creds = { schoolId: 's1', name: '张三', identityCode: '2024' };

  it('short-circuits invalid input without calling the network', async () => {
    const f = vi.fn();
    await expect(login({ schoolId: '', name: '', identityCode: '' }, f)).resolves.toEqual({
      ok: false,
      reason: 'invalid_input',
    });
    expect(f).not.toHaveBeenCalled();
  });

  it('returns the pass result on 200', async () => {
    const pass = { ok: true, school: { id: 's1', name: 'A' }, name: '张三' };
    const f = vi.fn().mockResolvedValue(mockResponse(200, pass));
    await expect(login(creds, f)).resolves.toEqual(pass);
  });

  it('maps 401 to not_authorized', async () => {
    const f = vi.fn().mockResolvedValue(mockResponse(401, { ok: false }));
    await expect(login(creds, f)).resolves.toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('maps server errors to server_error', async () => {
    const f = vi.fn().mockResolvedValue(mockResponse(502, {}));
    await expect(login(creds, f)).resolves.toEqual({ ok: false, reason: 'server_error' });
  });

  it('maps network exceptions to network_error', async () => {
    const f = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(login(creds, f)).resolves.toEqual({ ok: false, reason: 'network_error' });
  });
});
