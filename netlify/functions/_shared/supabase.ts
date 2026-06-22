// Shared helpers for Netlify Functions that talk to Supabase via its REST API.
// We deliberately avoid the @supabase/supabase-js dependency and use fetch so
// the project keeps a minimal dependency footprint. The service-role key is
// only ever read from the server-side environment and never sent to clients.

export interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

/**
 * Reads and validates the Supabase server credentials from the environment.
 * Returns null when either value is missing so callers can respond with a
 * generic 500 without leaking which variable is absent.
 */
export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv | null {
  const url = (env.SUPABASE_URL ?? '').trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), serviceRoleKey };
}

/** Standard JSON response helper for Netlify Functions. */
export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Performs a PostgREST GET request against a Supabase table.
 * `query` is the raw query string (already URL-encoded by the caller).
 */
export async function supabaseSelect(
  env: SupabaseEnv,
  table: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown[]> {
  const res = await fetchImpl(`${env.url}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase request failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
