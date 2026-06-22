// Day-based login session persistence.
// We only store a "passed today" marker plus display-only school/name.
// No allow-list or secrets are ever kept on the client.

export const AUTH_STORAGE_KEY = 'rebar-auth-v1';

export interface AuthSession {
  /** Local calendar day the user passed login, format YYYY-MM-DD. */
  day: string;
  school: { id: string | number; name: string };
  name: string;
}

/** Returns the local calendar day (YYYY-MM-DD) for the given date. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Builds a session object stamped with today's calendar day. */
export function makeSession(
  school: { id: string | number; name: string },
  name: string,
  date: Date = new Date(),
): AuthSession {
  return { day: dayKey(date), school, name };
}

/**
 * Validates a parsed session against the current day. Returns the session when
 * it is shaped correctly and still valid for `today`, otherwise null.
 */
export function validateSession(raw: unknown, today: string = dayKey()): AuthSession | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.day !== 'string' || s.day !== today) return null;
  if (typeof s.name !== 'string' || s.name === '') return null;
  const school = s.school as Record<string, unknown> | undefined | null;
  if (!school || (typeof school.id !== 'string' && typeof school.id !== 'number')) return null;
  if (typeof school.name !== 'string' || school.name === '') return null;
  return {
    day: s.day,
    name: s.name,
    school: { id: school.id, name: school.name },
  };
}

/** Reads and validates the current session from localStorage. */
export function loadSession(today: string = dayKey()): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = validateSession(JSON.parse(raw), today);
    if (!session) localStorage.removeItem(AUTH_STORAGE_KEY);
    return session;
  } catch {
    return null;
  }
}

/** Persists a session to localStorage. */
export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Clears the stored session. */
export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
