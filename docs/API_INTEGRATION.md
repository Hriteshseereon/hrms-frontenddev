# Connecting the frontend to the backend

The backend is **seereon-hrms-api** — Python, **FastAPI routes over the Django ORM** (one service, `/api/v1`). It was
built screen by screen from this frontend: every screen's flows, fields, validations and permissions have an
endpoint, and every endpoint lists the screens that call it (`x-screens`). The contract is
`docs/reference/openapi.json` (850 operations) with the screen-by-screen prose in `docs/reference/API_REFERENCE.md`;
both are generated from the backend code.

This guide covers the frontend side: what is already in place, and the steps to move a module from demo data to the
API.

---

## 1. What is already in place

| Piece         | File                              | Does                                                                                                                                                                                                                                                     |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration | `src/config/env.js`               | `VITE_API_BASE_URL` (…/api/v1), `VITE_DATA_MODE` (`mock`/`api`), `VITE_API_TIMEOUT_MS`                                                                                                                                                                   |
| HTTP client   | `src/services/api/client.js`      | JSON, bearer token, one silent refresh on 401 (`POST /auth/refresh`), `X-Company-Id` / `X-Branch-Id`, `Idempotency-Key`, `If-Match`, upload                                                                                                              |
| Errors        | `src/services/api/errors.js`      | `ApiError` with `status`, `code`, `detail`, `fieldErrors` — reads the backend's RFC 7807 bodies                                                                                                                                                          |
| Tokens        | `src/services/api/token-store.js` | access token in memory, refresh token in `sessionStorage`                                                                                                                                                                                                |
| Endpoints     | `src/services/api/endpoints/*.js` | one function per backend operation (named after the handler), grouped by chapter: `identityApi`, `platformApi`, `mastersApi`, `peopleApi`, `recruitmentApi`, `timeApi`, `payrollApi`, `performanceApi`, `exitApi`, `workApi`, `serviceApi`, `reportsApi` |
| React hooks   | `src/hooks/use-api.js`            | `useApiQuery` (cached reads) and `useApiMutation` (writes + toasts + cache refresh), built on TanStack Query                                                                                                                                             |

Every endpoint function carries a JSDoc header with the method, path, purpose and the screens that use it:

```js
/**
 * POST /leave/applications — Apply
 * Screens: /emp/leave, /org/leave
 * @param {object} body
 * @param {import('../client').RequestOptions} [options]
 */
export const leaveApply = (body, options) => api.post(`/leave/applications`, body, options);
```

Regenerate the endpoint files (and `docs/reference/openapi.json`, `API_REFERENCE.md`) from the backend after an API
change:

```bash
cd ../seereon-hrms-api && python tools/gen_api_docs.py --frontend ../seereon-hrms-web
```

## 2. Backend behaviour the client relies on

| Topic       | Behaviour                                                                                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base path   | `/api/v1`; Swagger UI at `/docs`, ReDoc at `/redoc`                                                                                                                                                                                                              |
| Auth        | `POST /auth/login {identifier, password, tab: super/admin/employee}` → `{accessToken, refreshToken, expiresIn, mustChangePassword, user}`; `POST /auth/refresh {refreshToken}` (rotating; reuse signs every session out); `POST /auth/logout`. Access JWT 15 min |
| Session     | `GET /me` → user, working scope (companies / branches), the screens and actions this user may use — drives the sidebar and `can()` in API mode                                                                                                                   |
| Scope       | `X-Company-Id` / `X-Branch-Id` from a Super Admin / Admin. A group Super Admin without a company works in the read-only collective view (writes → 403 `COLLECTIVE_READ_ONLY`)                                                                                    |
| Permissions | Enforced server-side on every call (role matrix + custom roles + temporary grants + delegations + module configuration)                                                                                                                                          |
| Errors      | RFC 7807 `application/problem+json` with `code` and `errors: [{ field, message }]`; 422 rule, 403 permission, 404, 409 state, 412 stale, 423 locked                                                                                                              |
| Paging      | `?page=&pageSize=&q=&sort=` → `{ items, total, page, pageSize }`                                                                                                                                                                                                 |
| Money       | JSON numbers (Decimal in the database)                                                                                                                                                                                                                           |
| Dates       | `YYYY-MM-DD`; instants ISO-8601; business calendar Asia/Kolkata                                                                                                                                                                                                  |
| Files       | `uploadFile(file, purpose)` → multipart `POST /files` → pass the returned id in the business request; `GET /files/{id}` to view                                                                                                                                  |
| Concurrency | `ETag` on records; send `If-Match` on edits (412 when stale)                                                                                                                                                                                                     |
| Idempotency | `Idempotency-Key` on POST (the first response is replayed)                                                                                                                                                                                                       |

## 3. Moving a module from demo data to the API — step by step

The unit of work is one domain (for example _leave_). Screens do not change; only the functions they call do.

1. **Find the data functions the screens use.** For leave: `useLeaveApplications()` (read) in
   `features/leave/data/leave-engine.js`, `submitLeaveApplication()` and `decideLeaveApplication()` (write).
2. **Find the matching endpoints** in `src/services/api/endpoints/time.js` — or call
   `endpointsForScreen`-style lookups by searching the JSDoc `Screens:` line for the route you are switching.
3. **Write an API version of each function** next to the demo one, with the same name and return shape:

   ```js
   // src/features/leave/data/leave-api.js
   "use client";
   import { timeApi } from "@/services/api";
   import { useApiQuery, useApiMutation } from "@/hooks/use-api";

   /** Same shape as the demo hook: [rows, setter] → here [rows, isLoading]. */
   export function useLeaveApplicationsApi(filters = {}) {
     const q = useApiQuery(["leave", "applications", filters], ({ signal }) =>
       timeApi.myApplications({ signal, query: filters }),
     );
     return [q.data?.items ?? [], q.isLoading];
   }

   export function useSubmitLeave() {
     return useApiMutation((body) => timeApi.leaveApply(body, { idempotencyKey: true }), {
       invalidate: [["leave"]],
       success: (app) => `Leave ${app.id} submitted`,
     });
   }
   ```

4. **Switch by data mode, once, at module level** (the mode is fixed at build time, so hooks stay stable):

   ```js
   // src/features/leave/data/leave-engine.js
   import { isApiMode } from "@/config/env";
   import { useLeaveApplicationsApi } from "./leave-api";

   const useLeaveApplicationsMock = () => [leaveApplicationStore.use(), leaveApplicationStore.set];
   export const useLeaveApplications = isApiMode()
     ? useLeaveApplicationsApi
     : useLeaveApplicationsMock;
   ```

5. **Keep the client-side validation** (`validateLeaveApplication` etc.) for instant feedback, and show server
   field errors: `err.fieldErrors.from` from `ApiError`.
6. **Test both modes.** `VITE_DATA_MODE=mock npm run dev` and `VITE_DATA_MODE=api npm run dev` against the backend
   (`uvicorn app.main:app` after `python manage.py migrate && python manage.py seed_demo` — the demo data is the same).
7. **Remove the demo store** for the module once the API version is live in every environment.

Recommended order (it follows the backend build order in the Development Flow document): auth & tenancy →
organisation & masters → employees → attendance & leave → payroll → recruitment, performance, exit → projects,
assets, helpdesk → reports.

## 4. Sign-in in API mode

`src/features/auth/data/auth-session.js` holds the demo sign-in and is the first module to switch (phase 1 of the
build). The change is contained in that file:

- `signIn(identifier, password)` → call `identityApi.login({ identifier, password, tab })`, store the tokens with
  `tokenStore.set(result)`, and keep `result.user` as the current identity (`mustChangePassword` → change-password
  screen first);
- `signOut()` → call `identityApi.logout()` and `tokenStore.clear()`;
- role screens and actions → load them from `identityApi.me()` (`GET /me` → `screens`, `actions`, `scope`) instead
  of the built-in `ROLE_NAV` / `ROLE_ACTIONS` tables.

The portal shells, role guards and menus keep working unchanged because they read the same `useCurrentUser()`,
`can()` and `canOpenPath()` functions.

## 5. Handling errors in screens

```js
try {
  await timeApi.leaveApply(body);
} catch (err) {
  if (err.isValidation)
    setErrors(err.fieldErrors); // show next to inputs
  else if (err.isConflict) toast.error("This record changed — reload and try again.");
  else toast.error(err.detail || "Something went wrong");
}
```

## 6. Where the demo data lives

| Kind                  | Where                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Seed records          | top of each `features/<domain>/data/*.js` (e.g. `LEAVE_APPLICATIONS`) |
| Browser storage keys  | `seereon.*` in `localStorage` — clear site data to reset              |
| Store → table mapping | `docs/reference/PRODUCT_DOCUMENTATION.md`, Appendix B                 |

The seed data is also the backend's demo data: `python manage.py seed_demo` loads the same records (extracted from
these files), so a fresh API environment matches the demo.
