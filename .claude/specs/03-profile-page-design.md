# Spec: Profile Page Design

## Overview
Build a fully functional, authenticated `/profile` page that displays the current
user's account information (name, email, verification status, member since) and
provides two in-page actions: update display name and change password. This page is
the first protected route in the frontend — it is only accessible when the user is
logged in; unauthenticated visitors are redirected to `/login`. The backend already
exposes all the required endpoints (`GET /account/me`, `POST /account/change-password`);
the work is entirely frontend-side plus adding an authenticated `PATCH /account/me`
route on the backend to support name updates.

## Depends on
- Step 01 — Registration: establishes `api.js` and the real backend connection.
- Step 02 — Login and Logout: establishes the access token in `AuthContext`,
  `GET /account/me`, and authenticated session management.

## Backend routes
- `PATCH /account/me` — update the authenticated user's display name — authenticated

Existing routes used as-is (no changes):
- `GET /account/me` — returns current user — authenticated
- `POST /account/change-password` — changes password — authenticated

## Backend files to change
- `Backend/app/account/routers.py` — add `PATCH /account/me` route (thin; calls service).
- `Backend/app/account/services.py` — add `update_user_name` service function.
- `Backend/app/account/schemas.py` — add `UserUpdate` request schema and extend
  `UserOut` to include `updated_at` field needed by the profile page.

## Backend files to create
None.

## Database changes
No database changes. The `User` model already has `name` and `updated_at` columns.

## Frontend routes
- `<Route path="/profile">` — maps to `Profile.jsx` — protected (redirect to `/login` if not authenticated)

## Frontend files to change
- `Frontend/src/App.jsx` — add a `ProtectedRoute` guard component, import and
  register the `<Route path="/profile">` entry.
- `Frontend/src/context/AuthContext.jsx` — add `updateName(name)` function that
  calls `PATCH /account/me` and refreshes `user` state; add `changePassword(payload)`
  function that calls `POST /account/change-password`.
- `Frontend/src/services/mockAuth.js` — add `updateName` and `changePassword` stub
  exports that forward to the real API (same pattern as existing login/logout).

## Frontend files to create

- `Frontend/src/pages/Profile.jsx` — authenticated profile page with account info display, inline name edit, and collapsible change-password form.

  ### Layout
  Centered single-column page (max-width ~560 px) with a header and two stacked cards: account info and password.

  ### Card 1 — Account info
  Circular avatar with initials on an indigo background. Beside it: full name with a small pencil icon button next to it, email below in muted text, and a verification badge on the right (green "Verified" or amber "Unverified", no action). Below a divider, a two-column grid shows "Member since" and "Last updated" in en-IN format; em dash if missing.

  Clicking the pencil expands an inline edit row with a text input pre-filled with the current name, plus Cancel and Save buttons. Save is disabled when the value is unchanged, empty, or saving. Empty submit shows an inline error. Success collapses the form, updates the displayed name, and shows a toast. Error keeps the form open with the typed value preserved.

  ### Card 2 — Password
  Compact by default: heading, subtext, and a right-aligned "Change password" button with a lock icon. Clicking expands the form; clicking again or Cancel collapses it.

  Expanded form has three stacked inputs (current, new, confirm) with a helper "At least 8 characters" under the new field, plus Cancel and Update buttons. Validation runs in order with inline errors (not toasts): required → min 8 chars → new ≠ current → new === confirm. Only then does the API fire. Success clears fields, collapses the form, and shows a toast. Server error keeps the form open with values preserved.

  ### Cross-section rules
  Each form owns its own state, submitting flag, and open/closed flag — they never affect each other. Page reads from `useAuth().user` only; no extra fetch on mount. Below ~640 px, the avatar stacks above the name and the metadata grid drops to one column. Pencil button has an aria-label; all inputs have proper labels; error containers use `aria-live="polite"`.

  ### Component structure
  Single default `Profile` export split internally into an account card (with inline name edit) and a password card (with collapsible form). Only the top-level component touches `AuthContext` and the toast hook.

## New dependencies
No new dependencies.

## Rules for implementation
- Async everywhere: `async def` on backend; `async` functions in service/context layers.
- Use `SessionDep` annotated dependency for DB access.
- Password hashed — `change_password` service already handles this; never hash on frontend.
- Raise `HTTPException(status_code=..., detail="...")` for all client errors.
- Frontend: function components + hooks only; Tailwind for styling; no CSS files.
- Frontend: surface all errors and successes via `useToast()`.
- The `ProtectedRoute` component must check `isAuthenticated` and `bootstrapping`
  from `useAuth()` — do not redirect during the bootstrap phase.
- `Profile.jsx` must read user data from `useAuth().user` — do not make a separate
  `GET /account/me` call on mount (the context already holds the user object).
- The update-name form and change-password form are separate, independent forms on
  the same page — submitting one must not affect the state of the other.
- The change-password form must have three fields: current password, new password,
  confirm new password. Client-side validation must check new ≠ current and
  new === confirm before hitting the API.
- After a successful name update, `AuthContext.user` must reflect the new name
  immediately (no page reload required).
- Do not implement other stub routes (`/verify-email`, `/reset-password`, `/change-password`).
- `PATCH /account/me` accepts only `name` — do not allow email changes via this route.

## Expected behaviour

```
PATCH /account/me
  Request:  header Authorization: Bearer <access_token>
            JSON body { name: str }
  200 OK:   { id, name, email, is_active, is_verified, created_at, updated_at }
  400:      "Name cannot be empty"
  401:      "Not authenticated"

POST /account/change-password
  Request:  header Authorization: Bearer <access_token>
            query param new_password: str
  200 OK:   { "msg": "Password changed successfully" }
  400:      "New password cannot be same as old password"
  401:      "Not authenticated"

GET /account/me  (already implemented — used by profile to seed AuthContext)
  Request:  header Authorization: Bearer <access_token>
  200 OK:   { id, name, email, is_active, is_verified, created_at }
  401:      "Not authenticated"
```

Frontend profile page behaviour:
1. Visiting `/profile` while unauthenticated redirects to `/login`.
2. Visiting `/profile` while authenticated renders:
   - Account info card: full name, email, verification badge, "Member since" date.
   - Update name form: single text input pre-filled with current name + Save button.
   - Change password form: current password, new password, confirm new password fields.
3. Submitting the update-name form:
   - Validates name is non-empty client-side.
   - Calls `AuthContext.updateName(name)` → `PATCH /account/me`.
   - On success: `toast.success("Name updated successfully")` + context user updated.
   - On error: `toast.error(err.message)`.
4. Submitting the change-password form:
   - Client-side: new password ≠ current password; new password === confirm; min 8 chars.
   - Calls `AuthContext.changePassword({ currentPassword, newPassword })`.
   - On success: `toast.success("Password changed successfully")` + form cleared.
   - On error: `toast.error(err.message)` (e.g. "New password cannot be same as old password").

## Definition of done
- [ ] Navigating to `/profile` while logged out redirects to `/login`.
- [ ] Navigating to `/profile` while logged in renders the profile page without errors.
- [ ] The profile card displays the correct name, email, verification status, and
      member-since date from `AuthContext.user`.
- [ ] Submitting the update-name form with a new valid name calls
      `PATCH /account/me` (visible in Network tab) and the displayed name updates
      immediately without a page reload.
- [ ] Submitting the update-name form with an empty name shows a client-side
      validation error before any network request is made.
- [ ] Submitting the change-password form with correct current password and a valid
      new password calls `POST /account/change-password` and shows the success toast.
- [ ] Submitting the change-password form where new password equals the current
      password shows the error toast: "New password cannot be same as old password".
- [ ] Submitting the change-password form where new and confirm passwords don't match
      shows a client-side validation error.
- [ ] Submitting the change-password form with new password under 8 characters shows
      a client-side validation error.
- [ ] The Navbar (or Landing page) exposes a link/button to `/profile` when logged in.
- [ ] No TypeScript, no new CSS files, no new npm packages introduced.
