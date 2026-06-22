# 登录门禁系统配置指南

首页登录使用 **Supabase 数据库 + Netlify Functions 服务端校验**。前端不直接访问数据库，也不持有任何密钥。

## 1. 创建 Supabase 表

在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL：

```sql
-- 学校表
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 授权用户表（学生 / 教师）
create table if not exists public.allowed_users (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  name          text not null,
  identity_code text not null,           -- 学号 / 工号
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 加速登录查询
create index if not exists idx_allowed_users_lookup
  on public.allowed_users (school_id, name, identity_code);

-- 开启 RLS：默认拒绝所有匿名访问。
-- Netlify Functions 使用 service_role key，可绕过 RLS，因此无需额外策略。
alter table public.schools enable row level security;
alter table public.allowed_users enable row level security;
```

## 2. 维护数据

直接使用 Supabase Dashboard 的 **Table Editor** 增删改：

- `schools`：添加学校，`is_active` 控制是否在下拉中显示。
- `allowed_users`：添加授权用户，选择 `school_id`，填写 `name` 和 `identity_code`（学号/工号），`is_active` 控制是否可登录。

> 注意：登录采用精确匹配（区分大小写与空格已在服务端 trim）。录入数据时请确保姓名与学号准确无误。

## 3. 配置 Netlify 环境变量

在 Netlify 站点的 **Site settings → Environment variables** 中添加：

| 变量名 | 说明 |
| --- | --- |
| `SUPABASE_URL` | Supabase 项目 URL，如 `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目的 service_role 密钥（仅服务端使用） |

本地可参考 `.env.example`。**切勿**把 service role key 暴露给前端或提交到仓库。

## 4. 接口说明

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/schools` | GET | 返回启用中的学校列表 `{ schools: [{ id, name }] }` |
| `/api/login` | POST | 入参 `{ schoolId, name, identityCode }`，三项全匹配返回 `{ ok: true, school, name }`，否则 401 |

`/api/*` 通过 `netlify.toml` 重写到 `/.netlify/functions/*`。

## 5. 前端登录态

- 登录成功后，仅在本地保存「当天有效的通过标记 + 展示用学校/姓名」（localStorage key：`rebar-auth-v1`）。
- 同一天刷新保持登录；跨天自动失效，需重新登录。
- 本地不保存名单、不保存任何密钥。

## 6. 本地开发

Vite 的 `npm run dev` 不会运行 Netlify Functions。若需本地联调，请安装并使用 Netlify CLI：

```bash
npm i -g netlify-cli
netlify dev
```

`netlify dev` 会同时启动 Vite 与本地 Functions，并自动注入 `.env` 中的变量。
