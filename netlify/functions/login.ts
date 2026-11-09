// POST /.netlify/functions/login
// Body: { schoolId, name, identityCode }
// Verifies the three values against the allowed_users table (joined to an
// active school). Returns a pass flag only when all three match.
import { readSupabaseEnv, supabaseSelect, json } from './_shared/supabase';

export interface LoginInput {
  name: string;
  identityCode: string;
}

/**
 * Validates and normalizes a raw request body. Trims whitespace and rejects
 * empty fields. Returns null when the payload is invalid.
 */
export function parseLoginBody(raw: unknown): LoginInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  const identityCode = String(body.identityCode ?? '').trim();
  if (!name || !identityCode) return null;
  return { name, identityCode };
}

/** Builds the URL-encoded PostgREST query for the allowed_users lookup. */
export function buildAllowedUsersQuery(input: LoginInput): string {
  const params = new URLSearchParams();
  params.set('select', 'id,name,identity_code,school_id,schools(id,name,is_active)');
  params.set('name', `eq.${input.name}`);
  params.set('identity_code', `eq.${input.identityCode}`);
  params.set('is_active', 'eq.true');
  params.set('limit', '1');
  return params.toString();
}

export interface LoginPass {
  ok: true;
  school: { id: string | number; name: string };
  name: string;
}

/**
 * Decides whether the returned rows represent a valid login. The matched user
 * must be active and belong to an active school.
 */
export function evaluateMatch(rows: unknown[], input: LoginInput): LoginPass | null {
  const row = rows.find(
    (r): r is Record<string, unknown> => typeof r === 'object' && r !== null,
  );
  if (!row) return null;
  const school = row.schools as Record<string, unknown> | undefined | null;
  if (!school || school.is_active !== true) return null;
  return {
    ok: true,
    school: { id: school.id as string | number, name: String(school.name ?? '') },
    name: input.name,
  };
}

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  let parsed: unknown;
  try {
    parsed = event.body ? JSON.parse(event.body) : null;
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const input = parseLoginBody(parsed);
  if (!input) {
    return json(400, { ok: false, error: 'invalid_input' });
  }

  const env = readSupabaseEnv();
  if (!env) {
    return json(500, { error: 'server_misconfigured' });
  }

  try {
    const rows = await supabaseSelect(env, 'allowed_users', buildAllowedUsersQuery(input));
    const pass = evaluateMatch(rows, input);
    if (!pass) {
      return json(401, { ok: false, error: 'not_authorized' });
    }
    return json(200, pass);
  } catch {
    return json(502, { ok: false, error: 'upstream_error' });
  }
};
