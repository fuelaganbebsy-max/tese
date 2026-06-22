import type { Plugin, Connect } from 'vite';

// ── 开发环境后台 mock ─────────────────────────────────────────────
// 仅在 `npm run dev` 下生效，用于在没有 Supabase / Netlify Functions 时
// 也能体验登录流程。生产构建不包含此逻辑，线上仍走真实 Netlify Functions。
//
// 维护种子数据：在下方 SCHOOLS / ALLOWED_USERS 增删即可。

interface MockSchool {
  id: string;
  name: string;
  isActive: boolean;
}

interface MockUser {
  schoolId: string;
  name: string;
  identityCode: string;
  isActive: boolean;
}

const SCHOOLS: MockSchool[] = [
  { id: 'a-college', name: 'A学院', isActive: true },
];

const ALLOWED_USERS: MockUser[] = [
  { schoolId: 'a-college', name: 'octopus', identityCode: '8000001002', isActive: true },
];

function send(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: Parameters<Connect.NextHandleFunction>[0]): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

export function authMockPlugin(): Plugin {
  return {
    name: 'auth-mock',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/schools', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const schools = SCHOOLS.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));
        send(res, 200, { schools });
      });

      server.middlewares.use('/api/login', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let parsed: Record<string, unknown> | null = null;
        try {
          const raw = await readBody(req);
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          return send(res, 400, { ok: false, error: 'invalid_json' });
        }
        const schoolId = String(parsed?.schoolId ?? '').trim();
        const name = String(parsed?.name ?? '').trim();
        const identityCode = String(parsed?.identityCode ?? '').trim();
        if (!schoolId || !name || !identityCode) {
          return send(res, 400, { ok: false, error: 'invalid_input' });
        }
        const school = SCHOOLS.find((s) => s.id === schoolId && s.isActive);
        const user = ALLOWED_USERS.find(
          (u) => u.schoolId === schoolId && u.name === name && u.identityCode === identityCode && u.isActive,
        );
        if (!school || !user) {
          return send(res, 401, { ok: false, error: 'not_authorized' });
        }
        send(res, 200, { ok: true, school: { id: school.id, name: school.name }, name });
      });

      // eslint-disable-next-line no-console
      console.log('[auth-mock] dev backend ready: /api/schools, /api/login');
    },
  };
}
