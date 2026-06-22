// GET /.netlify/functions/schools
// Returns the list of active schools for the login dropdown.
import { readSupabaseEnv, supabaseSelect, json } from './_shared/supabase';

export interface SchoolRow {
  id: string | number;
  name: string;
}

/** Maps raw Supabase rows into the minimal public shape sent to the client. */
export function mapSchools(rows: unknown[]): SchoolRow[] {
  return rows
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({ id: r.id as string | number, name: String(r.name ?? '') }))
    .filter((s) => s.id !== undefined && s.name !== '');
}

export const handler = async (event: { httpMethod?: string }) => {
  if (event.httpMethod && event.httpMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const env = readSupabaseEnv();
  if (!env) {
    // Do not reveal which variable is missing.
    return json(500, { error: 'server_misconfigured' });
  }

  try {
    const rows = await supabaseSelect(
      env,
      'schools',
      'select=id,name&is_active=eq.true&order=name.asc',
    );
    return json(200, { schools: mapSchools(rows) });
  } catch {
    return json(502, { error: 'upstream_error' });
  }
};
