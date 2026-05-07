# Spec: Send Email

## Overview
Replace the `print()` stubs in the email verification and password-reset flows
with real emails sent via Gmail SMTP. Currently both `email_verification_link_send`
and `password_reset_link_send` only print the link to the console, making these
flows completely unusable outside of local dev. This step wires `aiosmtplib`
into a thin `Backend/app/email.py` module that reads Gmail credentials from
environment variables, then updates the two service functions to `await` it.
No route contracts change — only the side-effect (print → real email).

## Depends on
- Step 01 — Registration: establishes user creation and email fields.
- Step 02 — Login and Logout: establishes the `/verify-request` and
  `/forget-password` routes that trigger the email send.

## Backend routes
No new routes. The existing routes are used as-is:
- `POST /account/verify-request` — sends verification email — authenticated
- `POST /account/forget-password` — sends password-reset email — public

## Backend files to change
- `Backend/app/account/services.py` — convert `email_verification_link_send`
  from `def` to `async def` and replace both `print()` stubs with
  `await send_email(...)` calls from the new `email.py` module.
- `Backend/app/account/routers.py` — add `await` to the
  `email_verification_link_send(user)` call site since it becomes async.

## Backend files to create
- `Backend/app/email.py` — thin async email module: reads `GMAIL_USER` and
  `GMAIL_APP_PASSWORD` from `os.environ` (fails fast with `RuntimeError` if
  missing), exposes `async def send_email(to: str, subject: str, html: str)`
  that connects to `smtp.gmail.com:587` with STARTTLS via `aiosmtplib`.

## Database changes
No database changes.

## Frontend routes
No new frontend routes.

## Frontend files to change
None.

## Frontend files to create
None.

## New dependencies
- Backend: `aiosmtplib` — async SMTP client for Gmail.
  Install with `uv add aiosmtplib` from `Backend/`.

## Rules for implementation
- Async everywhere: `send_email` must be `async def`; use `aiosmtplib.send()`
  or `aiosmtplib.SMTP` with `await`.
- Use annotated dependency for DB access — no changes to DB access patterns.
- Never hardcode credentials: read `GMAIL_USER` and `GMAIL_APP_PASSWORD` from
  `os.environ`. Raise `RuntimeError` at module import if either is missing so
  the server refuses to start rather than silently skipping emails.
- `APP_BASE_URL` should also come from `os.environ`, defaulting to
  `"http://localhost:5173"` so the links in emails point to the React frontend,
  not the raw FastAPI backend.
- Raise `HTTPException(status_code=500, detail="Failed to send email")` if
  the SMTP call raises — do not leak raw SMTP errors to the client.
- Frontend: no changes — function components + hooks only; Tailwind for
  styling; no CSS files.
- Do not implement other stub routes unless this task explicitly targets them.
- `.env` file must be listed in `.gitignore` — verify before committing.

## Expected behaviour

```
POST /account/verify-request  (authenticated)
  Request:  Authorization: Bearer <access_token>; no body
  200 OK:   { "msg": "Verification email sent" }
  500:      "Failed to send email"  (SMTP failure)

POST /account/forget-password  (public)
  Request:  query param `email: str`
  200 OK:   { "msg": "Reset password link sent" }
  404:      "User with this email does not exist"
  500:      "Failed to send email"  (SMTP failure)
```

Email content:
- **Verification email**
  - To: logged-in user's email
  - Subject: `"Verify your email – Auth System"`
  - HTML body: a link/button pointing to
    `{APP_BASE_URL}/verify-email?token=<token>`
- **Password-reset email**
  - To: the requested email address
  - Subject: `"Reset your password – Auth System"`
  - HTML body: a link/button pointing to
    `{APP_BASE_URL}/reset-password?token=<token>`

## Definition of done
- [ ] `GMAIL_USER` and `GMAIL_APP_PASSWORD` set in `.env`; server starts
      without errors.
- [ ] If either env var is missing, the server refuses to start with a clear
      `RuntimeError` message.
- [ ] Calling `POST /account/verify-request` while authenticated delivers an
      email to the user's Gmail inbox with a working verification link.
- [ ] Clicking the link in the verification email hits
      `GET /account/verify?token=<token>` and sets `is_verified = True`.
- [ ] Submitting the forgot-password form delivers a password-reset email to
      the address with a working link.
- [ ] Clicking the reset link navigates to `/reset-password?token=<token>` in
      the browser.
- [ ] No `print()` statements remain for verification or reset links.
- [ ] SMTP errors return HTTP 500 with `"Failed to send email"` — not a silent
      200.
- [ ] `.env` is in `.gitignore` and is not committed.
- [ ] No frontend files changed. No new npm packages introduced.
