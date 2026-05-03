# Plan: Login & Logout — wire `/login` and `/logout` to the real backend

## Context

`Frontend/src/services/mockAuth.js` still implements `login`, `logout`, and `getSession` against a `localStorage` user store + a fake JWT — a leftover from before Step 01 (Registration), which already replaced `register` with a real backend call via `apiFetch`. We need to finish that migration for the auth-session primitives so every protected-route feature that follows can rely on real session state. The spec (`/.claude/specs/02-login-and-logout.md`) names the exact files to touch and forbids changes to `Login.jsx`, `mockAuth.register`, `mockAuth.resetPassword`, the backend, and any new dependencies.

After this step:
- `POST /account/login` is called with an OAuth2 form-encoded body; the access token lives in `localStorage` and in `AuthContext` state.
- `GET /account/me` resolves the user object on login and on page refresh.
- `POST /account/logout` revokes the refresh token server-side; the client clears `localStorage` and resets `user` / `token` state.
- A page refresh rehydrates the session from `localStorage`; an invalid/expired token is cleared gracefully.

## Files to modify

1. `Frontend/src/services/api.js` — extend `apiFetch` so callers can supply an access token and a form-encoded body.
2. `Frontend/src/services/mockAuth.js` — replace `login`, `logout`, `getSession` with real backend calls (leave `register`, `resetPassword`, helpers untouched).
3. `Frontend/src/context/AuthContext.jsx` — make bootstrap effect async, propagate `token` through `login`, and clear both `user` and `token` on `logout`.

No file is created or deleted. No backend, no `Login.jsx`, no new packages.

---

## 1. `Frontend/src/services/api.js`

Today `apiFetch` JSON-stringifies plain object bodies and sets `Content-Type: application/json`; non-plain bodies (`FormData`, `URLSearchParams`) pass through with caller-supplied headers. Two small additions are needed.

**(a) `Authorization: Bearer <token>` support.** Add a `token` option destructured from `options`. When present, merge `Authorization: \`Bearer ${token}\`` into the final `headers` object (after the JSON content-type branch, so it applies regardless of body shape). Do not add the header when `token` is falsy — `/account/login` and `/account/logout` are public.

**(b) Form-encoded POST helper.** Export a small `apiFormPost(path, fields, options)` helper that builds a `URLSearchParams` from `fields` and delegates to `apiFetch(path, { method: 'POST', body: params, ...options })`. The browser auto-sets `Content-Type: application/x-www-form-urlencoded;charset=UTF-8` for `URLSearchParams` bodies, so the existing `isPlainObject` branch in `apiFetch` (which skips the JSON content-type for non-plain bodies) already does the right thing — no other change to `apiFetch`'s body handling is required.

Keep `credentials: 'include'` as the default so the `httpOnly` refresh-token cookie is set on login and cleared on logout (browser-managed; the frontend never reads it).

---

## 2. `Frontend/src/services/mockAuth.js`

Constants and helpers to **keep**: `USERS_KEY`, `LATENCY`, `wait`, `readUsers`, `writeUsers`, plus `register` and `resetPassword` exactly as-is.

Replace `SESSION_KEY` usage with a single token key `TOKEN_KEY = 'aurora.token'` (the spec requires only the access token in `localStorage`; the user object is fetched fresh from `/account/me`).

### `login({ email, password })`
- `await apiFormPost('/account/login', { username: email, password })` — note the `username` field name (FastAPI's `OAuth2PasswordRequestForm` requires it).
- Response is `{ access_token }`. Store with `localStorage.setItem(TOKEN_KEY, access_token)`.
- `const user = await apiFetch('/account/me', { token: access_token })`.
- Return `{ user, token: access_token }` so `AuthContext.login` and `Login.jsx` (`const { user } = await login(form)`) keep working unchanged.
- On `apiFormPost` rejection with `err.status === 401`, the error message will already be `"Invalid email or password."` from the backend's `detail` field; let it propagate so `Login.jsx`'s `toast.error(err.message)` path surfaces it verbatim.

### `logout()`
- `await apiFetch('/account/logout', { method: 'POST' })`. The refresh-token cookie is sent automatically because `credentials: 'include'` is the `apiFetch` default.
- Always `localStorage.removeItem(TOKEN_KEY)` in a `finally` — logout is best-effort; a network failure must still clear local state.

### `getSession()`  (becomes async)
- Read `localStorage.getItem(TOKEN_KEY)`. If absent, return `null`.
- Otherwise `try { const user = await apiFetch('/account/me', { token }); return { user, token } }`.
- On any failure (401, network error, parse error): `localStorage.removeItem(TOKEN_KEY)` and return `null`.

---

## 3. `Frontend/src/context/AuthContext.jsx`

### Bootstrap `useEffect`
`mockAuth.getSession` is now async, so wrap the call:
```js
useEffect(() => {
  let cancelled = false
  ;(async () => {
    const session = await mockAuth.getSession()
    if (cancelled) return
    if (session) {
      setUser(session.user)
      setToken(session.token)
    }
    setBootstrapping(false)
  })()
  return () => { cancelled = true }
}, [])
```
The `cancelled` guard prevents a state update if the provider unmounts mid-fetch (Strict Mode in dev double-invokes effects).

### `login` / `logout`
No further changes — both already call through to `mockAuth` and manage state correctly with the new shape `{ user, token }`.

---

## Out of scope (do not touch)

- `Login.jsx`, `Register.jsx`, `ResetPassword.jsx`, `ForgotPassword.jsx`.
- `mockAuth.register`, `mockAuth.resetPassword`.
- Any backend file.
- Stub frontend pages (`/verify-email`, `/change-password`, `/profile`).
- TypeScript, CSS files, new npm packages.

---

## Verification

Backend: `cd Backend && uv run fastapi dev app/main.py`.
Frontend: `cd Frontend && npm run dev`.

Walk through each Definition-of-Done item from the spec:

1. **Happy-path login.** Register a user, then sign in. Network tab shows `POST /account/login` with `Content-Type: application/x-www-form-urlencoded`, body `username=…&password=…`, response `{ access_token: "…" }`. Immediately after, a `GET /account/me` fires with `Authorization: Bearer …`.
2. **AuthContext populated.** `AuthProvider` shows `user` (real backend user object) and `token` (access JWT); `isAuthenticated` is `true`.
3. **Navigation.** App redirects to `/` after login.
4. **Wrong credentials.** Toast reads exactly `"Invalid email or password."`.
5. **Logout.** `POST /account/logout` clears cookie; `localStorage` token removed; `user` and `token` are `null`.
6. **No session restore after logout.** Refresh — still logged out.
7. **Refresh while logged in.** `GET /account/me` fires on bootstrap; session restores.
8. **Corrupted token.** Set `localStorage.aurora.token = 'garbage'` and refresh — session cleared gracefully.
9. **Mock removal.** No `users.find(...)` left in `login`/`logout`/`getSession`; `register` and `resetPassword` unchanged.
10. **No new deps.** `git diff Frontend/package.json` is empty.
