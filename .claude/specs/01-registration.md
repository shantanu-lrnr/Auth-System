# Spec: Registration

## Overview
Wire the existing `/register` page to the real FastAPI backend, replacing the
`mockAuth` layer for registration. A user fills in name, email, password, and
confirm-password; the form POSTs to `POST /account/register`; on success the
user is shown a toast and redirected to `/login`. This is the first step that
connects the React frontend to the real backend and establishes the `api.js`
service layer all future features will build on.

## Depends on
Nothing — this is step 1. The backend `/account/register` route is already
fully implemented.

## Backend routes
No new routes. The existing route is used as-is:
- `POST /account/register` — creates a new user — public

## Backend files to change
None. The backend is already complete for this feature.

## Backend files to create
None.

## Database changes
No database changes.

## Frontend routes
No new frontend routes. `/register` already exists and maps to `Register.jsx`.

## Frontend files to change
- `Frontend/src/services/mockAuth.js` — replace the `register` export with a
  real `fetch` call to `POST /account/register`; keep all other mock functions
  intact (login, logout, etc. are not in scope for this step).
- `Frontend/src/context/AuthContext.jsx` — after a successful register call the
  backend returns a `UserOut` object (no token); update the `register` function
  so it no longer sets `user`/`token` state (registration does not auto-login).
  The function should resolve cleanly so the page can redirect to `/login`.
- `Frontend/src/services/validators.js` — verify `validateRegister` enforces
  the constraints below; add rules if missing (min 8 chars password, passwords
  match). No changes needed if already correct.

## Frontend files to create
- `Frontend/src/services/api.js` — thin wrapper around `fetch` that sets
  `Content-Type: application/json`, reads the base URL from
  `import.meta.env.VITE_API_URL` (default `http://localhost:8000`), and throws
  an `Error` whose `.message` is the `detail` string from the FastAPI error
  body. All future API calls will import from this file.

## New dependencies
No new dependencies.

## Rules for implementation
- Async everywhere (all service functions are `async`).
- Use annotated dependency for DB access (backend only — no backend changes here).
- Password hashed (backend already does this — do not hash on the frontend).
- Raise `HTTPException(status_code=..., detail="...")` for all client errors
  (backend only — already implemented).
- Frontend: function components + hooks only; Tailwind for styling; no CSS files.
- Frontend: surface errors via `useToast()` (already wired in `Register.jsx`).
- `api.js` must parse FastAPI error bodies (`{ "detail": "..." }`) and expose
  the `detail` string as `Error.message` so existing `catch (err) → toast.error(err.message)` chains work without changes.
- Do not touch the mock implementations of `login`, `logout`, `resetPassword`,
  or `getSession` — those are not in scope.
- Do not implement stub routes (`/verify-email`, `/change-password`, `/profile`).
- `Register.jsx` itself should require **no changes** — all wiring goes in the
  service and context layers.
- `VITE_API_URL` should default gracefully in `api.js` so no `.env` file is
  required to run locally.

## Expected behaviour

```
POST /account/register
  Request:  JSON body { name: str, email: str, password: str }
  201 OK:   { id: int, name: str, email: str }
  400:      "User with this email already exist"
  422:      (FastAPI validation error — invalid email format, missing fields)
```

Frontend flow:
1. User submits the register form.
2. `validateRegister` runs client-side — inline field errors shown if invalid.
3. `AuthContext.register()` calls `api.js` → `POST /account/register`.
4. On 201: `toast.success("Account created. Welcome, <first name>.")` then
   `navigate('/login', { replace: true })`.
5. On error: `toast.error(err.message)` — e.g. "User with this email already
   exist" propagated from the backend `detail`.
6. `user` and `token` state in `AuthContext` remain `null` after registration
   (no auto-login; the backend returns `UserOut`, not tokens).

## Definition of done
- [ ] Submitting the register form with a new email creates a row in `sqlite.db`
      (verify via `/account/me` after manually logging in, or by inspecting the
      DB).
- [ ] Registering with a duplicate email shows the toast: "User with this email
      already exist".
- [ ] Registering with mismatched passwords shows a client-side validation error
      before any network request is made.
- [ ] Registering with a password shorter than 8 characters shows a client-side
      validation error.
- [ ] After successful registration the user lands on `/login`.
- [ ] No `mockAuth.register` call is made (verify in Network tab — a real
      `POST http://localhost:8000/account/register` request appears).
- [ ] `mockAuth.login`, `mockAuth.logout`, and `mockAuth.getSession` are
      unchanged and still work (login page still functions as before).
- [ ] No TypeScript, no new CSS files, no new npm packages introduced.
