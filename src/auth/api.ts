// Client-side API wrappers for the login门禁 backend.
// These call serverless functions through the /api/* routes.

export interface School {
  id: string | number;
  name: string;
}

export interface LoginResult {
  ok: true;
  school: School;
  name: string;
}

export const LOGIN_ENDPOINT = '/api/login';

/** Normalizes form fields the same way the server does (trim). */
export function normalizeCredentials(input: {
  name: string;
  identityCode: string;
}) {
  return {
    name: input.name.trim(),
    identityCode: input.identityCode.trim(),
  };
}

/** True when both required fields are non-empty after trimming. */
export function credentialsComplete(input: {
  name: string;
  identityCode: string;
}): boolean {
  const c = normalizeCredentials(input);
  return Boolean(c.name && c.identityCode);
}

export interface LoginError {
  ok: false;
  reason: 'not_authorized' | 'invalid_input' | 'server_error' | 'network_error';
}

/** Submits credentials and returns either a pass result or a typed error. */
export async function login(
  input: { name: string; identityCode: string },
  fetchImpl: typeof fetch = fetch,
): Promise<LoginResult | LoginError> {
  const body = normalizeCredentials(input);
  if (!body.name || !body.identityCode) {
    return { ok: false, reason: 'invalid_input' };
  }
  let res: Response;
  try {
    res = await fetchImpl(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'network_error' };
  }

  if (res.status === 200) {
    const data = (await res.json()) as LoginResult;
    return data;
  }
  if (res.status === 401) return { ok: false, reason: 'not_authorized' };
  if (res.status === 400) return { ok: false, reason: 'invalid_input' };
  return { ok: false, reason: 'server_error' };
}
