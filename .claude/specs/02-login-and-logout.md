# Spec: Login and Logout

## Overview
Wire the existing `/login` and `/logout` pages to the real FastAPI backend,
replacing the `mockAuth` layer for login and logout. On login, the user submits
email and password; the form POSTs to `POST /account/login` using an
OAuth2 password form; on success the access token is stored in memory (via
`AuthContext`) and the `httpOnly` refresh-token cookie is set by the server.
On logout, the frontend calls `POST /account/logout` which revokes the refresh
token on the server and clears the cookie; client state is cleared. This step
establishes authenticated session management that all future protected-route
features will rely on.

## Depends on
- Step 01 — Registration: establishes `api.js` (the fetch wrapper), the real
  backend connection, and the base `AuthContext` shape that this step extends.

## Backend routes
No new routes. Both routes are already fully implemented:
- `POST /account/login` — authenticates user, sets refresh-token cookie, returns access token — public
- `POST /account/logout` — revokes refresh token, clears cookie — public (no auth required; best-effort)

## Backend files to change
None. The backend is already complete for this feature.

## Backend files to create
None.

## Database changes
No database changes.

## Frontend routes
No new frontend routes. `/login` already exists and maps to `Login.jsx`.

## Frontend files to change
- `Frontend/src/services/mockAuth.js` — replace the `login`, `logout`, and
  `getSession` exports with real implementations that call the backend;
  `login` posts to `POST /account/login` (form-encoded), stores the access
  token in `localStorage`, and calls `GET /account/me` to get the user object;
  `logout` posts to `POST /account/logout` and clears `localStorage`;
  `getSession` reads the token from `localStorage` and calls `GET /account/me`
  to rehydrate the session on page refresh.
- `Frontend/src/context/AuthContext.jsx` — update the `login` function so it
  stores the returned access token in state and resolves the user from the
  `/me` response; update `logout` to call the real logout service and clear
  both `user` and `token` state; update bootstrap `useEffect` to call the
  real `getSession`.
- `Frontend/src/services/api.js` — add a helper for sending
  `application/x-www-form-urlencoded` POST requests (required for OAuth2
  password flow), and add support for passing the `Authorization: Bearer`
  header when a token is provided.

## Frontend files to create
None.

## New dependencies
No new dependencies.

## Rules for implementation
- Async everywhere (all service functions are `async`).
- Use annotated dependency for DB access (backend only — no backend changes here).
- Password hashed (backend handles this — do not hash on the frontend).
- Raise `HTTPException(status_code=..., detail="...")` for all client errors
  (backend only — already implemented).
- Frontend: function components + hooks only; Tailwind for styling; no CSS files.
- Frontend: surface errors via `useToast()` on login failure.
- The login request MUST be `application/x-www-form-urlencoded` with fields
  `username` (email value) and `password` — FastAPI's `OAuth2PasswordRequestForm`
  requires this exact format; do not send JSON.
- The access token must be stored so it survives navigation within the tab but
  is cleared on logout. `localStorage` is acceptable for this learning project.
- The refresh-token cookie is `httpOnly` and managed entirely by the server;
  the frontend must never read or write it directly.
- `GET /account/me` requires `Authorization: Bearer <token>` — pass the stored
  token via the `api.js` helper.
- On page refresh, attempt to rehydrate the session by reading the token from
  `localStorage` and calling `/account/me`; if that call fails (token expired),
  clear storage and treat the user as logged out.
- Do not implement stub routes (`/verify-email`, `/change-password`, `/profile`).
- `Login.jsx` itself should require no changes — all wiring goes in the service
  and context layers.
- Do not touch `mockAuth.register` or `mockAuth.resetPassword` — those are not
  in scope.
- Note: the refresh-token cookie has `secure=True` on the backend. For local dev
  over plain HTTP, the cookie will not be sent. For this step, session persistence
  relies on the access token in `localStorage`; the full refresh-token rotation
  flow is a future concern.

## Expected behaviour

```
POST /account/login
  Request:  form-encoded body { username: str (email), password: str }
  200 OK:   { access_token: str }
            + sets httpOnly cookie: refresh_token
  401:      "Invalid email or password."

GET /account/me
  Request:  header Authorization: Bearer <access_token>
  200 OK:   { id: int, name: str, email: str }
  401:      "Not authenticated" (missing/invalid token)

POST /account/logout
  Request:  no body; server reads refresh_token cookie
  200 OK:   { msg: "Logged out successfully" }
            + clears refresh_token cookie
  (no error cases — logout is best-effort)
```

Frontend login flow:
1. User submits the login form (email + password).
2. `AuthContext.login()` calls `mockAuth.login()` → `POST /account/login`
   (form-encoded).
3. On 200: store `access_token` in `localStorage`; call `GET /account/me` to
   get the user object; set `user` and `token` state in `AuthContext`.
4. Navigate to `/` (landing page) on success.
5. On 401: `toast.error("Invalid email or password.")`.

Frontend logout flow:
1. User clicks logout (wherever it's surfaced — Navbar or profile).
2. `AuthContext.logout()` calls `mockAuth.logout()` → `POST /account/logout`.
3. Remove `access_token` from `localStorage`; set `user` and `token` to `null`.
4. Navigate to `/login`.

Frontend bootstrap (page refresh):
1. `useEffect` in `AuthContext` calls `mockAuth.getSession()`.
2. `getSession` reads token from `localStorage`; if none, returns `null`.
3. If token exists, calls `GET /account/me` with the token.
4. On success: return `{ user, token }` → set state.
5. On failure (401): clear `localStorage`, return `null`.

## Definition of done
- [ ] Submitting the login form with correct credentials returns an access token
      from the real backend (visible in Network tab as `POST /account/login`).
- [ ] After login, `AuthContext.user` is populated with the real user object
      from `GET /account/me`.
- [ ] After login, navigating to `/` shows the authenticated UI (Navbar reflects
      logged-in state if applicable).
- [ ] Logging in with wrong credentials shows the toast: "Invalid email or
      password."
- [ ] Clicking logout calls `POST /account/logout` (visible in Network tab),
      clears `localStorage`, and sets `user` to `null`.
- [ ] After logout, navigating back to a protected area (or refreshing) does not
      restore the session.
- [ ] Refreshing the page while logged in rehydrates the session from
      `localStorage` without requiring the user to log in again.
- [ ] If the stored token is invalid (manually corrupted), the session is cleared
      gracefully and the user is treated as logged out.
- [ ] No `mockAuth.login`, `mockAuth.logout`, or `mockAuth.getSession` mock
      implementations remain (replaced by real calls).
- [ ] `mockAuth.register` and `mockAuth.resetPassword` are unchanged.
- [ ] No TypeScript, no new CSS files, no new npm packages introduced.
