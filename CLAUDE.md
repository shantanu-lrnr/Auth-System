# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

A full-stack authentication system with a FastAPI backend (JWT auth, refresh-token rotation, real Gmail SMTP for email verification & password reset, soft-delete with 30-day grace, admin user management) and a React frontend (login, register, password reset, profile, admin panel). Built as a learning project.

## 2. Architecture

### Backend (`Backend/app/`)

```
main.py              FastAPI app + lifespan (auto-creates SQLite tables on startup)
db/config.py         Async engine, Base, async_session, SessionDep (Annotated dep)
account/
  routers.py         /account/* routes + nested /account/admin/users/* sub-router
  services.py        Business logic; raises HTTPException directly
  utils.py           Password hashing (argon2), JWT + refresh-token primitives
  email.py           Gmail SMTP send_email (aiosmtplib) + render_action_email HTML template
  dependencies.py    get_current_user, required_admin
  models.py          User (with deletion_requested_at), RefreshToken (cascade delete)
  schemas.py         Pydantic request/response models
sqlite.db            Auto-created on first run (NOT under migrations)
```

**Where things belong:**
- New HTTP route → `routers.py` (thin; just calls a service). Admin routes go on the nested `admin_router` (`/account/admin/users/...`).
- New business logic → `services.py`. Raise `HTTPException` for client-facing errors.
- New token / crypto helper → `utils.py`.
- New email template / SMTP work → `email.py` (use `render_action_email` for branded buttons; queue via `BackgroundTasks`).
- New auth/permission gate → `dependencies.py` (compose with `Depends(get_current_user)`).
- DB model change → `models.py`. Schema is recreated on startup; **there is no migration tool**, so deleting `sqlite.db` is the dev workflow.

**Token model — important to internalize:**
- **Access token**: short-lived JWT (15 min, HS256), `sub = user.id`. Sent as `Authorization: Bearer ...`.
- **Refresh token**: opaque UUID stored in the `refresh_token` table with `revoked` + `expires_at`. Set as an `httpOnly` cookie by `/login` and `/refresh`. `/refresh` revokes the old row before issuing a new one (rotation).
- **Email-verify / password-reset tokens**: also JWTs, distinguished by a `type` claim (`"verify"` / `"reset"`) checked in `verify_token_and_get_user_id`.

**Soft-delete model:**
- `User.deletion_requested_at` is nullable. `POST /account/delete-request` (password-confirmed) sets it + `is_active = False` and revokes all refresh tokens.
- `authenticate_user` checks `deletion_requested_at` **before** the `is_active` gate: within 30 days → restore (clear flag, reactivate, log in); past 30 days → 403 `"Account is permanently deleted."`. Only after that does the normal `is_active` admin-block check apply. Permanent purge is not yet implemented.

### Frontend (`Frontend/src/`)

```
main.jsx                       Mounts <BrowserRouter><ToastProvider><AuthProvider><App/>>
App.jsx                        Routes + GuestRoute / ProtectedRoute / AdminRoute guards
context/AuthContext.jsx        useAuth(): user, token, login, register, logout, updateName,
                               changePassword, requestAccountDeletion, revalidateSession,
                               requestVerification, verifyEmail, plus admin helpers
                               (listUsers, toggleUserActive, ..., downloadUsersCsv)
context/ToastContext.jsx       useToast(): success/error notifications
services/api.js                apiFetch with silent refresh on 401 + 'aurora.session-expired' event
services/mockAuth.js           Thin wrappers over apiFetch (name is legacy — these hit real backend)
services/validators.js         Form validation
components/auth/               Page shells: AuthLayout, Navbar, AuroraBackground
components/ui/                 Primitives: Button, Card, Input
pages/                         Landing, Login, Register, ForgotPassword, ResetPassword,
                               VerifyEmail, Profile, AdminPanel
```

**Where things belong:**
- New route → add a `<Route>` in `App.jsx` (wrap with the appropriate guard) and a page in `pages/`.
- API call → add to `services/api.js` or `services/mockAuth.js`, then expose via `AuthContext`. Keep the `AuthContext` interface stable so pages don't need to change.
- Reusable input/button → `components/ui/`. Auth-page-specific layout → `components/auth/`.

**Session lifecycle:**
- `apiFetch` retries once on 401 via `/account/refresh`. If that fails, it clears the token and dispatches `aurora.session-expired` with the original 401 detail; `AuthContext` listens and clears React state + toasts the reason.
- `ProtectedRoute` and `AdminRoute` call `revalidateSession()` on every navigation so deactivation/deletion takes effect without a hard refresh.

## 3. Code Style

**Python (Backend)**
- Async everywhere: `async def` routes/services, `AsyncSession`, `await session.commit()`. Don't introduce sync DB calls.
- Use the `SessionDep` annotated dependency, not raw `Depends(get_session)`, for consistency.
- Type hints on every function signature (`Mapped[...]` for models, `EmailStr` / Pydantic models for I/O).
- Raise `HTTPException(status_code=..., detail="...")` for client errors — don't return error dicts.
- Routers should be thin; put logic in `services.py`.
- Send email via `BackgroundTasks.add_task(send_email, ...)` so the request doesn't block on SMTP.
- 4-space indent, double quotes are common but not enforced — match the surrounding file.

**JavaScript / React (Frontend)**
- Function components + hooks only. No classes.
- Single quotes, no semicolons (matches existing files), 2-space indent.
- Tailwind utility classes for styling — do not add CSS files or CSS-in-JS.
- Form pattern: local `useState` for `form` / `errors` / `submitting`; validate via `services/validators.js`; surface results via `useToast()`.
- Access auth state through `useAuth()`.

## 4. Preferred Libraries / Tech Constraints

**Backend (pinned in `pyproject.toml`, managed by `uv`)**
- Web: `fastapi[standard]` — use `fastapi dev` for local dev (don't reach for `uvicorn` directly).
- ORM: `sqlalchemy[asyncio]` 2.x style (`Mapped`, `mapped_column`, `select(...)`).
- DB driver: `aiosqlite`. SQLite only — **do not** add Postgres/MySQL drivers without discussing.
- Hashing: `passlib[argon2]` via the existing `pwd_context`. Don't switch to bcrypt.
- JWT: `python-jose[cryptography]` (`from jose import jwt`).
- Email: `aiosmtplib` to Gmail SMTP. Required env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `GMAIL_FROM`, `APP_BASE_URL`. Loaded from `.env` at the repo root. The app **will fail to import `email.py`** if these are missing.
- Python ≥ 3.13. Don't use syntax requiring newer.
- **No migrations tool installed.** Don't add Alembic without asking.

**Frontend (pinned in `package.json`)**
- React 19, React Router 7, Vite 8, Tailwind 3, framer-motion, lucide-react.
- ESLint configured; no Prettier, no TypeScript. Don't introduce TS without asking.
- **No test runner.** Don't add Vitest/Jest without asking.
- Package manager: `npm` (lockfile is `package-lock.json`).

## 5. Implemented vs Stub Routes

**Backend — fully implemented (`/account` prefix):**
| Route | Method | Notes |
|---|---|---|
| `/register` | POST | Creates user (rejects duplicate email). |
| `/login` | POST | OAuth2 password form. Sets `refresh_token` cookie + returns access token. Restores soft-deleted accounts within 30-day window. |
| `/refresh` | POST | Reads cookie, rotates refresh token, returns new pair. |
| `/me` | GET | Returns current user. |
| `/me` | PATCH | Update display name (`UserUpdate { name }` body). |
| `/verify-request` | POST | Authenticated. Sends real verification email via Gmail SMTP. |
| `/verify` | GET | Consumes verify token, sets `is_verified = True`. |
| `/change-password` | POST | Authenticated. `new_password` is a **query parameter** (see warnings). |
| `/delete-request` | POST | Authenticated. Body `{ password }`. Soft-deletes (`is_active=False`, `deletion_requested_at=now`), revokes all refresh tokens, clears cookie. |
| `/forget-password` | POST | Sends real reset email via Gmail SMTP. |
| `/reset-password` | POST | Consumes reset token. |
| `/logout` | POST | Revokes refresh token, clears cookie. |

**Backend — admin sub-router (`/account/admin/users` prefix, `required_admin` gate):**
| Route | Method | Notes |
|---|---|---|
| `/` | GET | Paginated list with `page`, `page_size`, `search`, `sort_by`, `order`, `role`, `status` filters. |
| `/` | POST | Admin creates a user (`AdminUserCreate` — can set `is_admin`). |
| `/stats` | GET | Totals: total / active / admins / new_this_month. |
| `/export` | GET | CSV download with same filters as list. |
| `/{user_id}` | GET | Single user by id. |
| `/{user_id}/toggle-active` | PATCH | Activate/deactivate. Revokes tokens on deactivate. Cannot target self or other admins. |
| `/{user_id}/toggle-admin` | PATCH | Grant/revoke admin. Cannot target self or other admins. |

**Frontend — pages (`React Router`, `pages/` + `App.jsx`):**
| Route | Guard | Status |
|---|---|---|
| `/` | — | Implemented (`Landing.jsx`) |
| `/login` | Guest | Implemented |
| `/register` | Guest | Implemented |
| `/forgot-password` | Guest | Implemented — triggers reset email |
| `/reset-password` | Guest | Implemented — consumes reset token from URL |
| `/verify-email` | — | Implemented — consumes verify token from URL |
| `/profile` | Protected | Implemented — name edit, password change, resend verification, danger-zone delete |
| `/admin` | Admin | Implemented — `AdminPanel.jsx`, full user management UI |

**There are no stub frontend pages remaining.** New features mean new routes/pages.

## 6. Commands

### Backend (run from `Backend/`)

```bash
# Setup
uv venv

# Install dependencies
uv sync

# Run FastAPI dev server (requires GMAIL_USER + GMAIL_APP_PASSWORD in .env at repo root)
uv run fastapi dev app/main.py

# Run all tests
uv run pytest

# Run a specific test file
uv run pytest tests/test_foo.py

# Run a specific test by name
uv run pytest -k "test_name"

# Run tests with output visible
uv run pytest -s
```

### Frontend (run from `Frontend/`)

```bash
# Setup
npm install

# Run Vite dev server
npm run dev

# Production build → dist/
npm run build

# Serve the built dist/
npm run preview

# Lint
npm run lint
```

> No test runner is configured on the frontend. Verify manually in the browser.

## 7. Critical Rules / Warnings

- **`SECRET_KEY = "MY-SECRET-KEY"`** is hardcoded in `app/account/utils.py`. Same key signs access, verify, AND reset tokens. Treat as dev-only; do not deploy.
- **Query-parameter passwords**: `/change-password`, `/forget-password`, `/reset-password` accept `new_password` / `email` / `token` as **query params**, not request bodies. Almost certainly a bug, but match the existing shape unless explicitly asked to migrate to a Pydantic body. (`/delete-request` is the exception — it correctly takes a JSON body.)
- **Refresh-token cookie has `secure=True`** → it will not be sent over plain HTTP. The Vite dev frontend on `http://localhost` will not receive it without HTTPS or flipping `secure=False` for dev.
- **Email is real, not stubbed.** `app/account/email.py` raises at import time if `GMAIL_USER` / `GMAIL_APP_PASSWORD` are missing — the backend won't start without them. Use a Gmail app password.
- **`services/mockAuth.js` is misleadingly named** — despite the "mock" prefix it calls the real backend via `apiFetch`. Don't replace it with another mock layer.
- **Admin self-protection**: `toggle_user_active` / `toggle_user_admin` both refuse to act on the calling admin or on any other admin. If you're adding new admin actions, mirror this pattern.
- **`.claude/specs/`** holds the per-feature spec files (one per implemented step). Read the relevant spec when continuing or extending an existing feature.
- **Never install new packages** mid-feature without flagging it.

## 8. Additional Notes

- **CWD matters**: `uv run` and `npm` commands assume you're in `Backend/` or `Frontend/` respectively. The repo root has no top-level package manifest, but it does hold the `.env` consumed by `app/account/email.py`.
