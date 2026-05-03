# Plan: Wire `/register` page to real FastAPI backend

## Context

The `/register` page currently submits through `mockAuth.register`, which writes to `localStorage` and returns a fake `{ user, token }`. This is the first step that connects the React frontend to the real FastAPI backend at `POST /account/register`. It also establishes the shared `services/api.js` HTTP wrapper that every subsequent feature (login, refresh, verify, reset, etc.) will reuse.

The backend `/account/register` route already exists and is correct (`UserCreate` JSON in → `UserOut` 201 out, 400 on duplicate email). The frontend `validateRegister` rules already match the spec. `Register.jsx` already destructures `{ user }` from `register()` and uses `user.name` for the toast — it must remain unchanged.

Two issues uncovered during exploration that the spec missed and the user has confirmed:
1. The backend has **no `CORSMiddleware`** — the cross-origin `localhost:5173 → localhost:8000` request will be blocked. We add CORS to `Backend/app/main.py`.
2. `AuthContext.register` must return `{ user }` (wrapping the backend's `UserOut`) so `Register.jsx` keeps working — and must NOT set `user`/`token` state (no auto-login; the user lands on `/login`).

## Approach

1. **Create** `Frontend/src/services/api.js` — single shared `apiFetch` helper. Owns base URL, JSON encoding, and FastAPI error parsing for both 400 (string `detail`) and 422 (array `detail`) shapes.
2. **Modify** `Frontend/src/services/mockAuth.js` — replace only the `register` export with a thin call to `apiFetch`. Leave `login`, `logout`, `resetPassword`, `getSession` and helpers (`wait`, `readUsers`, `writeUsers`, `fakeJwt`, `stripPwd`) untouched.
3. **Modify** `Frontend/src/context/AuthContext.jsx` — change `register()` to await the service, NOT call `setUser`/`setToken`, and return `{ user }`.
4. **Modify** `Backend/app/main.py` — add `CORSMiddleware` for `http://localhost:5173`, `allow_credentials=True`, all methods/headers.

No new packages. No `.env` file required (default fallback baked in). `Register.jsx`, `validators.js`, `main.jsx`, `ToastContext.jsx`, `vite.config.js`, `package.json` are unchanged.

## Files to Create

### `Frontend/src/services/api.js`

Single source of HTTP truth. All future services import from this.

- `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'`
- `export const apiFetch = async (path, options = {}) => { ... }`
  - `method` defaults to `'GET'`.
  - If `options.body` is a plain object (not `FormData`/`URLSearchParams`/`string`) → JSON-stringify it and merge `'Content-Type': 'application/json'`. Otherwise pass body through unchanged (forward-compatible with `/login`'s `URLSearchParams`).
  - `credentials` defaults to `'include'` (forward-compatible with refresh-token cookie).
  - URL is `${API_URL}${path}`.
  - On `res.ok`: `204` → `null`; else try `await res.json()` (return `null` if body is empty/non-JSON).
  - On non-ok: parse JSON body, derive a string via `extractErrorMessage(body, status)`, throw `new Error(message)`. Attach `err.status = res.status`.
  - Network failures: rethrow as `new Error('Network error — could not reach server.')`.
- Module-private `extractErrorMessage(body, status)`:
  - `body?.detail` is a string → return it (covers 400).
  - `body?.detail` is an array → return `body.detail[0]?.msg || 'Validation error.'` (covers 422).
  - Else → return `` `Request failed (${status}).` ``.

Style: single quotes, no semicolons, 2-space indent, `async`/`await`, no classes.

## Files to Modify

### `Frontend/src/services/mockAuth.js`

Replace only the `register` export. Keep every other export and helper exactly as-is.

New shape:

```
import { apiFetch } from './api'

export const register = async ({ name, email, password }) => {
  const user = await apiFetch('/account/register', {
    method: 'POST',
    body: { name, email, password },
  })
  return { user }
}
```

- Returns `{ user }` only (no token).
- Throws on backend error — `apiFetch` already converts `detail` → `Error.message`.
- Does NOT touch `localStorage` (no session write on register).

### `Frontend/src/context/AuthContext.jsx`

Replace the `register` function (currently lines 27–32):

```
const register = async (payload) => {
  const { user } = await mockAuth.register(payload)
  return { user }
}
```

- No `setUser` / `setToken` calls — registration does not auto-login.
- Return shape preserved so `Register.jsx`'s `const { user } = await register(...)` keeps working.
- Errors propagate; `Register.jsx`'s existing try/catch handles toasts.

Bootstrap `useEffect`, `login`, `logout`, `resetPassword`, `useMemo` (deps still `[user, token, bootstrapping]`), and `useAuth` hook all unchanged.

### `Backend/app/main.py`

Add `CORSMiddleware` immediately after `app = FastAPI(lifespan=lifespan)` and before `app.include_router(account_router)`.

```
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
```

Trade-off: `allow_credentials=True` is not strictly needed for `/register` today, but the next step (`/login`) uses a refresh-token cookie. Setting it now avoids revisiting CORS later. Cost: cannot use `allow_origins=['*']` alongside it (Starlette refuses) — we list `5173` explicitly.

`fastapi` already brings `starlette`, which provides `CORSMiddleware`. **No new packages.**

## Critical Files

- `Frontend/src/services/api.js` (create)
- `Frontend/src/services/mockAuth.js` (modify — `register` only)
- `Frontend/src/context/AuthContext.jsx` (modify — `register` only)
- `Backend/app/main.py` (modify — add CORS middleware)
- `Frontend/src/pages/Register.jsx` (read-only reference — must remain unchanged)

## Verification

### 1. Backend startup (from `Backend/`)
```
uv run fastapi dev app/main.py
```
Server on `http://127.0.0.1:8000`. Confirm `http://localhost:8000/docs` lists `POST /account/register` and shows no import errors.

### 2. Frontend startup (from `Frontend/`)
```
npm run dev
```
Confirm Vite prints `Local: http://localhost:5173/`. If it picks a different port (e.g. 5174), CORS will reject — free port 5173 first.

### 3. Happy path
- Open `http://localhost:5173/register`.
- Fill: `Test User` / `test1@example.com` / `password123` / `password123`. Submit.
- Toast: `Account created. Welcome, Test.`
- Redirect to `/login` (replace history).
- Network tab: `OPTIONS` preflight 200 with `access-control-allow-origin: http://localhost:5173`, then `POST /account/register` 201 with body `{"id":<int>,"name":"Test User","email":"test1@example.com"}`.
- React DevTools: `AuthContext` value still has `user: null`, `token: null`, `isAuthenticated: false`.

### 4. DB confirmation
From `Backend/`:
```
sqlite3 sqlite.db "select id, name, email, is_verified from user where email='test1@example.com';"
```
Expect one row, `is_verified = 0`.

### 5. Duplicate-email negative path
Re-submit the same email. Network: `400` with `{"detail":"User with this email already exist"}`. Toast renders that string. No redirect.

### 6. Client-side validation (no network)
- Mismatched passwords → inline error under "Confirm password", no network call.
- Short password (< 8 chars) → inline error, no network call.
- Invalid email format → inline error, no network call.

### 7. 422 parser sanity (via Swagger)
Hit `/account/register` from Swagger with `{"name":"x","email":"not-email","password":"password123"}`. Confirm 422 array body shape. (Not reachable from UI; just validates `extractErrorMessage`.)

### 8. Cleanup
`Backend/sqlite.db` shows as modified in `git status` — expected. Do not commit the DB. To start clean: delete `Backend/sqlite.db` and let `lifespan` recreate it.

## Risks

1. **Vite port drift.** If 5173 is taken, Vite picks 5174+ silently. CORS will reject. Mitigation: read the URL Vite prints; free 5173 or extend `allow_origins`.
2. **`allow_credentials=True` + wildcard origin incompatible.** Anyone later "simplifying" to `['*']` will break login. Inline comment in `main.py` is worth considering during implementation.
3. **Refresh-token cookie issue on `/login` (out of scope, flagged).** Backend sets `secure=True`, which Firefox/Safari may drop on plain `http://localhost`. Not this step's problem — registration uses no cookies — but it will bite step 2. Recommended follow-up: gate `secure` on a dev/prod flag.
4. **422 body shape differs from 400.** Without the array branch in `extractErrorMessage`, the toast would render `[object Object]`. Already covered.
5. **`mockAuth.js` filename now misleading** (half real, half mock). Acceptable per spec; renaming deferred to a future step when login/logout migrate.
6. **`apiFetch` defaults `credentials: 'include'`.** Harmless for `/register`; forward-compatible with `/login` and `/refresh`. `apiFetch` only prepends `API_URL`, so it never sends cookies cross-domain unintentionally.
