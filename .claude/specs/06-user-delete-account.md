# Spec: User Delete Account

## Overview
Authenticated users can request account deletion by confirming their password. Deletion is soft: the account is deactivated immediately (`is_active = False`, `deletion_requested_at = now`) and the user is logged out. If the user logs back in within 30 days the account is automatically restored. If 30 days pass without a login, a background cleanup job permanently removes the row (and all cascade-linked refresh tokens). This gives users a safety net against accidental deletion.

## Depends on
- Step 01 — Registration (user model exists)
- Step 02 — Login / Logout (auth dependencies, token lifecycle)

## Backend routes
- `POST /account/delete-request` — authenticated user submits password to request account deletion (sets soft-delete state, logs out) — **authenticated**

## Backend files to change
- `Backend/app/account/models.py` — add `deletion_requested_at: Mapped[datetime | None]` column to `User`.
- `Backend/app/account/routers.py` — add `POST /account/delete-request` route.
- `Backend/app/account/services.py` — add `request_account_deletion` service; update `authenticate_user` to restore account if logging in within the 30-day grace window.
- `Backend/app/account/schemas.py` — add `DeleteAccountRequest` schema (`password: str` body field).

## Backend files to create
None.

## Database changes
Add one nullable column to `User`:

```
deletion_requested_at: Mapped[datetime | None] = mapped_column(
    DateTime(timezone=True), nullable=True, default=None
)
```

No migration tool — delete `sqlite.db` and restart to recreate the schema.

Permanent purge of expired soft-deleted accounts is **out of scope** for this step (no background worker / scheduled job will be implemented now). The column and grace-period restore logic are in scope; the purge is a future task.

## Frontend routes
No new frontend routes. The delete UI lives as a new card inside the existing `/profile` page.

## Frontend files to change
- `Frontend/src/pages/Profile.jsx` — add `DeleteAccountCard` component at the bottom of the page.
- `Frontend/src/context/AuthContext.jsx` — expose `requestAccountDeletion({ password })` that calls the service and clears auth state on success.
- `Frontend/src/services/mockAuth.js` — add `requestAccountDeletion` export calling `POST /account/delete-request`.

## Frontend files to create
None.

## New dependencies
No new dependencies.

## Rules for implementation
- Async everywhere on the backend (`async def`, `AsyncSession`, `await session.commit()`).
- Use `SessionDep` annotated dependency for DB access.
- Raise `HTTPException(status_code=..., detail="...")` for all client errors.
- Verify the submitted password with `verify_password` before doing anything; reject with 400 if wrong.
- After marking the account for deletion: revoke all refresh tokens (`revoke_all_user_tokens`), clear the `refresh_token` cookie, and set `is_active = False` + `deletion_requested_at = now`.
- In `authenticate_user`: check `deletion_requested_at` **before** the `is_active` gate (because soft-deleted accounts have `is_active = False` and would otherwise be blocked). If `deletion_requested_at` is set and within 30 days → restore (`is_active = True`, `deletion_requested_at = None`), commit, proceed with login. If past 30 days → 403 `"Account is permanently deleted."`. Only after this block should the `is_active` check run (to catch admin-deactivated accounts).
- Frontend: function components + hooks only; Tailwind for styling; no CSS files.
- Frontend: surface success/error via `useToast()`.
- The delete button must reveal a password-confirmation form (inline) — no one-click delete.
- Do not implement other stub routes unless this task explicitly targets them.

## Expected behaviour

```
POST /account/delete-request
  Request:  Authorization: Bearer <access_token>
            Body (JSON): { "password": "string" }
  200 OK:   { "msg": "Account scheduled for deletion. You have 30 days to log back in to restore it." }
            Clears refresh_token cookie.
  400:      "Incorrect password"
  401:      "Not authenticated"
  404:      "User not found"
```

```
POST /account/login  (modified behaviour for soft-deleted accounts)
  Within 30-day window → account restored, login succeeds normally.
  After 30-day window  → 403 "Account is permanently deleted."
  Account active (normal) → unchanged behaviour.
```

Frontend flow:
1. User opens `/profile` and scrolls to the "Danger Zone" Delete Account card.
2. Card shows a "Delete account" button (destructive styling).
3. Clicking reveals an inline password-confirmation form with a warning message explaining the 30-day grace period.
4. On submit: calls `requestAccountDeletion({ password })` from `AuthContext`.
5. On success: auth state is cleared (token removed from localStorage, `user` → `null`), user is navigated to `/`.
6. On error: toast error is shown, form stays open.
7. "Cancel" button hides the form without any API call.

## Definition of done
- [ ] `POST /account/delete-request` with correct password returns 200 and clears the cookie.
- [ ] `POST /account/delete-request` with wrong password returns 400 `"Incorrect password"`.
- [ ] `POST /account/delete-request` with no/invalid token returns 401.
- [ ] After deletion request, the user cannot log in with a new session (account is inactive) — except via the grace-period restore path.
- [ ] Logging in within 30 days restores `is_active = True` and `deletion_requested_at = None`, and login succeeds.
- [ ] Logging in after 30 days returns 403 `"Account is permanently deleted."`.
- [ ] All refresh tokens are revoked on deletion request (no active sessions remain).
- [ ] Frontend: Delete Account card renders on `/profile` below the Password card.
- [ ] Frontend: Clicking "Delete account" shows the password form with a grace-period warning.
- [ ] Frontend: Correct password clears auth state and redirects to `/`.
- [ ] Frontend: Wrong password shows a toast error and keeps the form open.
- [ ] Frontend: "Cancel" hides the form without any API call.
