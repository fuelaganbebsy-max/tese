// Client-side API wrappers for the login门禁 backend.
// These call Netlify Functions through the /api/* rewrites.

export interface School {
  id: string | number;
  name: string;
}

export interface LoginResult {
  ok: true;
  school: School;
  name: string;
}

export const SCHOOLS_ENDPOINT = '/api/schools';
export const LOGIN_ENDPOINT = '/api/login';

/** Normalizes form fields the same way the server does (trim). */
export function normalizeCredentials(input: {
  schoolId: string;
  name: string;
  identityCode: string;
}) {
  return {
    schoolId: input.schoolId.trim(),
    name: input.name.trim(),
    identityCode: input.identityCode.trim(),
  };
}

/** True when all three required fields are non-empty after trimming. */
export function credentialsComplete(input: {
  schoolId: string;
  name: string;
  identityCode: string;
}): boolean {
  const c = normalizeCredentials(input);
  return Boolean(c.schoolId && c.name && c.identityCode);
}

/** Fetches the active school list for the dropdown. */
export async function fetchSchools(fetchImpl: typeof fetch = fetch): Promise<School[]> {
  const res = await fetchImpl(SCHOOLS_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('schools_unavailable');
  const data = (await res.json()) as { schools?: School[] };
  return Array.isArray(data.schools) ? data.schools : [];
}

export interface LoginError {
  ok: false;
  reason: 'not_authorized' | 'invalid_input' | 'server_error' | 'network_error';
}

/** Submits credentials and returns either a pass result or a typed error. */
export async function login(
  input: { schoolId: string; name: string; identityCode: string },
  fetchImpl: typeof fetch = fetch,
): Promise<LoginResult | LoginError> {
  const body = normalizeCredentials(input);
  if (!body.schoolId || !body.name || !body.identityCode) {
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
