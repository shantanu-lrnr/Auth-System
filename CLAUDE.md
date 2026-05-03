# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

A full-stack authentication system with a FastAPI backend (JWT auth, refresh-token rotation, email verification) and a React frontend (login, register, password reset). Built as a learning project.

## 2. Architecture

### Backend (`Backend/app/`)

```
main.py              FastAPI app + lifespan (auto-creates SQLite tables on startup)
db/config.py         Async engine, Base, async_session, SessionDep (Annotated dep)
account/
  routers.py         /account/* routes
  services.py        Business logic; raises HTTPException directly
  utils.py           Password hashing (argon2), JWT + refresh-token primitives
  dependencies.py    get_current_user, required_admin
  models.py          User, RefreshToken (cascade delete)
  schemas.py         Pydantic request/response models
sqlite.db            Auto-created on first run (NOT under migrations)
```

**Where things belong:**
- New HTTP route → `routers.py` (thin; just calls a service).
- New business logic → `services.py`. Raise `HTTPException` for client-facing errors.
- New token / crypto helper → `utils.py`.
- New auth/permission gate → `dependencies.py` (compose with `Depends(get_current_user)`).
- DB model change → `models.py`. Schema is recreated on startup; **there is no migration tool**, so deleting `sqlite.db` is the dev workflow.

**Token model — important to internalize:**
- **Access token**: short-lived JWT (15 min, HS256), `sub = user.id`. Sent as `Authorization: Bearer ...`.
- **Refresh token**: opaque UUID stored in the `refresh_token` table with `revoked` + `expires_at`. Set as an `httpOnly` cookie by `/login` and `/refresh`. `/refresh` revokes the old row before issuing a new one (rotation).
- **Email-verify / password-reset tokens**: also JWTs, distinguished by a `type` claim (`"verify"` / `"reset"`) checked in `verify_token_and_get_user_id`.

### Frontend (`Frontend/src/`)

```
main.jsx                       Mounts <BrowserRouter><ToastProvider><AuthProvider><App/>>
App.jsx                        Public routes only: /login, /register, /reset-password
context/AuthContext.jsx        useAuth(): { user, token, isAuthenticated, login, register, logout, ... }
context/ToastContext.jsx       useToast(): success/error notifications
services/validators.js         Form validation
components/auth/               Page shells: AuthLayout, Navbar, AuroraBackground
components/ui/                 Primitives: Button, Card, Input
pages/                         Login, Register, ResetPassword
```

**Where things belong:**
- New route → add a `<Route>` in `App.jsx` and a page in `pages/`.
- API call → goes through the service layer via `AuthContext`. Keep the `AuthContext` interface intact so pages don't change.
- Reusable input/button → `components/ui/`. Auth-page-specific layout → `components/auth/`.

## 3. Code Style

**Python (Backend)**
- Async everywhere: `async def` routes/services, `AsyncSession`, `await session.commit()`. Don't introduce sync DB calls.
- Use the `SessionDep` annotated dependency, not raw `Depends(get_session)`, for consistency.
- Type hints on every function signature (`Mapped[...]` for models, `EmailStr` / Pydantic models for I/O).
- Raise `HTTPException(status_code=..., detail="...")` for client errors — don't return error dicts.
- Routers should be thin; put logic in `services.py`.
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
| `/login` | POST | OAuth2 password form. Sets `refresh_token` cookie + returns access token. |
| `/refresh` | POST | Reads cookie, rotates refresh token, returns new pair. |
| `/me` | GET | Returns current user. |
| `/verify-request` | POST | Generates verify token; **prints link to console** (no real email). |
| `/verify` | GET | Consumes verify token, sets `is_verified = True`. |
| `/change-password` | POST | Authenticated. `new_password` is a **query parameter** (see warnings). |
| `/forget-password` | POST | Generates reset token; **prints link to console**. |
| `/reset-password` | POST | Consumes reset token. |
| `/admin` | GET | Gated by `required_admin`. Returns greeting only. |
| `/logout` | POST | Revokes refresh token, clears cookie. |

**Backend — stub / placeholder:**
- Email sending — `email_verification_link_send` and `password_reset_link_send` only `print()`. No SMTP / mailer.
- `/admin` — has no real admin functionality, just demonstrates the gate.

**Frontend — pages (`React Router`, `pages/` + `App.jsx`):**
| Route | Status |
|---|---|
| `/` | Implemented — renders `Landing.jsx` |
| `/login` | Implemented — renders `Login.jsx` |
| `/register` | Implemented — renders `Register.jsx` |
| `/forgot-password` | Implemented — email input form, triggers password reset link (`ForgotPassword.jsx`) |
| `/reset-password` | Stub — new password form, consumes reset token from URL |
| `/verify-email` | Stub — email verification page (consumes token from URL) |
| `/change-password` | Stub — authenticated change-password form |
| `/profile` | Stub — authenticated profile / account page |

**Do not implement a stub route unless the active task explicitly targets that feature.**

## 6. Commands

### Backend (run from `Backend/`)

```bash
# Setup
uv venv

# Install dependencies
uv sync

# Run FastAPI dev server
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
- **Query-parameter passwords**: `/change-password`, `/forget-password`, `/reset-password` accept `new_password` / `email` / `token` as **query params**, not request bodies. Almost certainly a bug, but match the existing shape unless explicitly asked to migrate to a Pydantic body.
- **Refresh-token cookie has `secure=True`** → it will not be sent over plain HTTP. The Vite dev frontend on `http://localhost` will not receive it without HTTPS or flipping `secure=False` for dev.
- **Never install new packages** mid-feature without flagging it

## 8. Additional Notes

- **CWD matters**: `uv run` and `npm` commands assume you're in `Backend/` or `Frontend/` respectively. The repo root has no top-level package manifest.