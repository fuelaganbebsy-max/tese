# Excel User Import Design

## Goal

Allow administrators to maintain login users from an Excel file and import them into the existing Supabase-backed login gate.

The current login flow stays unchanged:

- The browser calls `/api/schools` and `/api/login`.
- Netlify Functions query Supabase tables with the service role key.
- The client stores only the "passed today" session marker.

This feature adds a local administrator import tool. It does not add a browser-based admin page.

## Excel Format

The importer accepts one worksheet with a header row. Required columns:

| Column | Meaning | Required |
| --- | --- | --- |
| `学校名称` | School display name. Used to find or create a row in `schools`. | Yes |
| `姓名` | User name used during login. | Yes |
| `学号/工号` | Identity code used during login. | Yes |
| `是否启用` | User active flag. Accepts `是`, `否`, `true`, `false`, `1`, `0`. Blank means enabled. | No |

Rows with missing required values are rejected with a clear row-numbered error. Whitespace is trimmed before validation and upload.

## Command

Add a script command:

```bash
npm run import:users -- data/users.xlsx
```

The command reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment, matching the existing Netlify Functions configuration.

## Data Flow

1. Parse the workbook using a Node Excel parser.
2. Validate headers and normalize rows.
3. Fetch existing `schools` from Supabase.
4. Create any missing active schools by name.
5. Upsert users into `allowed_users` by `(school_id, name, identity_code)`.
6. Print a summary: schools created, users inserted, users updated, rows skipped or rejected.

The import should be idempotent: running the same Excel twice should not create duplicate schools or users.

## Supabase Requirements

Keep the existing tables:

- `schools(id, name, is_active, created_at)`
- `allowed_users(id, school_id, name, identity_code, is_active, created_at)`

Add or document unique indexes for reliable upsert behavior:

```sql
create unique index if not exists idx_schools_name_unique
  on public.schools (name);

create unique index if not exists idx_allowed_users_unique_login
  on public.allowed_users (school_id, name, identity_code);
```

These indexes make repeated imports safe and prevent duplicate login identities.

## Error Handling

The importer fails before writing when:

- The file path is missing or unreadable.
- Required headers are absent.
- Any row is missing `学校名称`, `姓名`, or `学号/工号`.
- `是否启用` has an unsupported value.
- Supabase environment variables are missing.

Network or Supabase API failures should stop the import and report the operation that failed.

## Testing

Add focused tests for:

- Header parsing and required-column validation.
- Row normalization and active-flag parsing.
- Invalid row reporting with Excel row numbers.
- Idempotent planning behavior for existing schools/users.

The tests should exercise the import logic without contacting real Supabase. Supabase HTTP calls should be isolated behind small functions that can be tested separately or injected in tests.

## Out Of Scope

- Browser admin upload page.
- Admin authentication UI.
- Password-based login.
- Client-side Excel parsing.
- Storing the Excel file in the deployed app.
