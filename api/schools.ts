// GET /api/schools — Vercel Function (mirrors netlify/functions/schools.ts)
// Returns the list of active schools for the login dropdown.
// The site is deployed on Vercel, which does not run Netlify Functions,
// so this file exists alongside the Netlify version.
import { readSupabaseEnv, supabaseSelect } from '../netlify/functions/_shared/supabase';

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

/** Standard JSON response helper (Web Response for Vercel). */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const env = readSupabaseEnv(process.env);
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
}
