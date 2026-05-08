# Spec: Admin Panel

## Overview
Build a functional admin panel that replaces the current stub `/account/admin` route (which only returns a greeting) with real administrative capabilities. Admins can list all users, view individual user details, toggle `is_active` status, promote/demote admin role, and delete accounts permanently. A protected `/admin` frontend page exposes these actions in a simple table UI, accessible only to users with `is_admin = True`.

## Depends on
- Step 01 — Registration: establishes the `User` model and `is_admin` field.
- Step 02 — Login and Logout: establishes JWT auth and `get_current_user` / `required_admin` dependencies.
- Step 04 — Send Email: establishes the `UserOut` schema shape used in responses.

## Backend routes
- `GET /account/admin/users` — list all users (paginated, searchable, sortable) — admin
- `GET /account/admin/users/{user_id}` — get a single user by ID — admin
- `PATCH /account/admin/users/{user_id}/toggle-active` — flip `is_active` — admin
- `PATCH /account/admin/users/{user_id}/toggle-admin` — flip `is_admin` — admin
- `DELETE /account/admin/users/{user_id}` — soft-delete user (sets `is_active=False`, `deleted_at=now`) — admin
- `PATCH /account/admin/users/{user_id}/restore` — restore a soft-deleted user — admin

## Backend files to change
- `Backend/app/account/routers.py` — add the six new admin routes; replace the existing stub `GET /account/admin` route.
- `Backend/app/account/services.py` — add service functions: `list_users`, `get_user_by_id`, `toggle_user_active`, `toggle_user_admin`, `soft_delete_user`, `restore_user`.
- `Backend/app/account/schemas.py` — add `UserListOut` (paginated wrapper: `items: list[UserOut]`, `total: int`, `page: int`, `page_size: int`) and `AdminActionOut` (simple `{ "msg": str, "user": UserOut }`).

## Backend files to create
None.

## Database changes
Add one new column to the `User` model:
- `deleted_at: Mapped[datetime | None]` — `nullable=True`, default `None`. Set to `utcnow()` on soft-delete; cleared to `None` on restore. Combined with `is_active=False` this signals an admin-deleted account (distinct from a user-initiated deactivation which has no `deleted_at`).

## Frontend routes
- `<Route path="/admin">` — maps to `AdminPanel` page, protected by a new `AdminRoute` guard (requires `isAuthenticated` AND `user.is_admin`).

## Frontend files to change
- `Frontend/src/App.jsx` — add `AdminRoute` guard component and `/admin` route.
- `Frontend/src/context/AuthContext.jsx` — add `listUsers`, `toggleUserActive`, `toggleUserAdmin`, `softDeleteUser`, `restoreUser` methods that call the real API via `services/api.js`.
- `Frontend/src/services/api.js` — add admin API call functions.
- `Frontend/src/services/mockAuth.js` — add matching mock stubs so the mock layer doesn't break.

## Frontend files to create
- `Frontend/src/pages/AdminPanel.jsx` — table of all users with search input, sortable column headers, and per-row action buttons (toggle active, toggle admin, soft-delete, restore). Shows current user's own row as read-only to prevent self-lockout.

## New dependencies
No new dependencies.

## Rules for implementation
- Async everywhere: all service functions must be `async def`; use `AsyncSession`.
- Use `SessionDep` annotated dependency for DB access.
- Raise `HTTPException(status_code=..., detail="...")` for all client errors — no error dicts.
- An admin cannot toggle their own `is_admin` or `is_active` or delete themselves — return 400 with a clear message. Enforce this server-side; mirror it in the UI.
- An admin cannot delete or deactivate another admin — return 403. Only a superuser pattern would allow this, which is out of scope.
- **Soft delete**: `soft_delete_user` sets `is_active=False` and `deleted_at=utcnow()` and revokes all refresh tokens for that user. Does NOT remove the row.
- **Restore**: `restore_user` sets `is_active=True` and `deleted_at=None`. Only valid when `deleted_at` is set; if not, return 400 "User is not deleted".
- **Search**: `GET /account/admin/users` accepts optional `search: str` query param; filter by case-insensitive substring match on `name` OR `email` using SQLAlchemy `ilike`.
- **Sorting**: accept `sort_by: str` (allowed values: `name`, `email`, `created_at`, `is_active`, `is_admin`; default `created_at`) and `order: str` (`asc` / `desc`; default `desc`). Reject unknown `sort_by` values with 400 "Invalid sort field".
- Pagination: default `page=1`, `page_size=20`; accept both as query params.
- Frontend: search is a controlled text input; debounce API calls by 300ms. Sorting is triggered by clicking column headers (toggle asc/desc on second click).
- Frontend: function components + hooks only; Tailwind for styling; no CSS files.
- Frontend: surface all errors via `useToast()`; surface success actions with a toast too.
- Access auth state through `useAuth()` only.
- Do not implement other stub routes unless this task explicitly targets them.

## Expected behaviour

```
GET /account/admin/users?page=1&page_size=20&search=alice&sort_by=created_at&order=desc
  Request:  Authorization: Bearer <admin_access_token>
  200 OK:   { "items": [UserOut, ...], "total": 42, "page": 1, "page_size": 20 }
  400:      "Invalid sort field"
  401:      "Not authenticated" (missing/invalid token)
  403:      "Not authorized" (non-admin token)

GET /account/admin/users/{user_id}
  Request:  Authorization: Bearer <admin_access_token>
  200 OK:   UserOut
  403:      "Not authorized"
  404:      "User not found"

PATCH /account/admin/users/{user_id}/toggle-active
  Request:  Authorization: Bearer <admin_access_token>; no body
  200 OK:   { "msg": "User activated" | "User deactivated", "user": UserOut }
  400:      "Cannot modify your own account"
  403:      "Cannot modify another admin's account"
  404:      "User not found"

PATCH /account/admin/users/{user_id}/toggle-admin
  Request:  Authorization: Bearer <admin_access_token>; no body
  200 OK:   { "msg": "Admin role granted" | "Admin role revoked", "user": UserOut }
  400:      "Cannot modify your own account"
  403:      "Cannot modify another admin's account"
  404:      "User not found"

DELETE /account/admin/users/{user_id}
  Request:  Authorization: Bearer <admin_access_token>
  200 OK:   { "msg": "User soft-deleted successfully" }
  400:      "Cannot delete your own account"
  403:      "Cannot delete another admin's account"
  404:      "User not found"

PATCH /account/admin/users/{user_id}/restore
  Request:  Authorization: Bearer <admin_access_token>; no body
  200 OK:   { "msg": "User restored successfully", "user": UserOut }
  400:      "Cannot restore your own account"
  400:      "User is not deleted"
  403:      "Cannot restore another admin's account"
  404:      "User not found"
```

## Definition of done
- [ ] `GET /account/admin/users` returns all users paginated; non-admin token gets 403.
- [ ] `search` param filters by name or email (case-insensitive); empty/absent returns all users.
- [ ] `sort_by` + `order` params sort results correctly; unknown `sort_by` returns 400.
- [ ] `GET /account/admin/users/{user_id}` returns correct user or 404.
- [ ] `PATCH /account/admin/users/{user_id}/toggle-active` flips `is_active`; a deactivated user cannot log in (backend `authenticate_user` checks `is_active`).
- [ ] `PATCH /account/admin/users/{user_id}/toggle-admin` flips `is_admin`; promoted user can immediately access admin routes.
- [ ] `DELETE /account/admin/users/{user_id}` sets `is_active=False` and `deleted_at=now`; user row remains in DB; user's refresh tokens are revoked.
- [ ] `PATCH /account/admin/users/{user_id}/restore` clears `deleted_at` and sets `is_active=True`; returns 400 if user was not soft-deleted.
- [ ] All six admin routes return 400 when the target is the calling admin's own account (self-protection).
- [ ] Admin cannot act on another admin — returns 403.
- [ ] `/admin` frontend route redirects non-admins to `/profile`.
- [ ] Admin panel page renders a table of all users with Name, Email, Verified, Active, Admin, Deleted columns.
- [ ] Search input filters the table live (debounced 300ms); typing clears pagination back to page 1.
- [ ] Clicking a column header sorts by that column; clicking again reverses order; active sort column shows an arrow indicator.
- [ ] Each row has Toggle Active, Toggle Admin, Soft Delete, and Restore buttons; own row buttons are disabled.
- [ ] Restore button is only visible/enabled when `deleted_at` is set on that user.
- [ ] Actions show a success or error toast after completion and refresh the user list.
- [ ] `authenticate_user` in `services.py` rejects login when `is_active = False`.
