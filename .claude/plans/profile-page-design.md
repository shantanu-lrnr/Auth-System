# Plan: Profile Page (Step 03)

## Context

Step 03 of the Auth System adds the first **protected** frontend route (`/profile`)
and the first authenticated **mutation** beyond auth (`PATCH /account/me`).

The page lets a logged-in user:
1. View their account info (name, email, verification status, member-since, last-updated).
2. Edit their display name inline.
3. Change their password through a collapsible form.

Steps 01 (registration) and 02 (login/logout) wired up `api.js`, `AuthContext`, and
`mockAuth.js`; this step extends those layers with two new operations and adds a
`ProtectedRoute` guard. The backend has `GET /account/me` and `POST /account/change-password`
already; we add a thin `PATCH /account/me` route plus the matching service/schema.

The user has heavily customised the **UI Layout** section of the spec, so the plan
follows that wording closely (avatar with initials, pencil-icon inline edit, collapsible
password form, validation order, `aria-live`, mobile breakpoint at ~640px, etc.).

---

## Backend changes

### 1. `Backend/app/account/schemas.py` — add `UserUpdate`, extend `UserOut`

```python
class UserUpdate(BaseModel):
    name: str

class UserOut(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime          # NEW — needed by profile "Last updated"
    model_config = {"from_attributes": True}
```

`User.updated_at` already exists on the model (`Backend/app/account/models.py:19`)
with `onupdate=lambda: datetime.now(timezone.utc)`, so `session.refresh(user)` after
mutation gives us the new value automatically.

### 2. `Backend/app/account/services.py` — add `update_user_name`

```python
async def update_user_name(session: AsyncSession, user: User, name: str) -> User:
    cleaned = name.strip() if name else ""
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    user.name = cleaned
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
```

Same pattern as the existing `change_password` service — raise `HTTPException` on
client errors, `await session.commit()`, return the updated `User`.

### 3. `Backend/app/account/routers.py` — add `PATCH /account/me`

Add after the existing `me` route (around line 89). Reuse `get_current_user`
and `SessionDep`, and the new `UserUpdate` schema:

```python
@router.patch("/me", response_model=UserOut)
async def update_me(
    session: SessionDep,
    payload: UserUpdate,
    user: Annotated[User, Depends(get_current_user)],
):
    return await update_user_name(session, user, payload.name)
```

Also add `update_user_name` to the imports from `app.account.services` and
`UserUpdate` to the imports from `app.account.schemas`.

**No new routes for change-password** — the existing `POST /account/change-password`
(query param `new_password`) is reused as-is. No current password field on the frontend.

### Database

No migration tool — schema is recreated on startup via `lifespan` in `main.py`.
Adding `updated_at` to `UserOut` is a pure Pydantic change; the column already
exists on `User`. **No need to delete `sqlite.db`.**

---

## Frontend changes

### 1. `Frontend/src/services/mockAuth.js` — add two exports

Pattern: thin wrappers over `api.js`, accepting `token` as a parameter (not
read from localStorage), matching how `login`/`logout` are written.

```js
export const updateName = async ({ name, token }) =>
  apiFetch('/account/me', { method: 'PATCH', body: { name }, token })

export const changePassword = async ({ newPassword, token }) =>
  apiFetch(
    `/account/change-password?new_password=${encodeURIComponent(newPassword)}`,
    { method: 'POST', token },
  )
```

The change-password URL uses a query string because the backend route declares
`new_password: str` as a query param (see `routers.py:100`). Encoding handles
special characters safely.

### 2. `Frontend/src/context/AuthContext.jsx` — add `updateName` and `changePassword`

```js
const updateName = async (name) => {
  const updated = await mockAuth.updateName({ name, token })
  setUser(updated)            // Refreshes user state immediately
  return updated
}

const changePassword = async ({ newPassword }) =>
  mockAuth.changePassword({ newPassword, token })
```

Add both to the `useMemo` value object so they're available via `useAuth()`.
`updateName` updates `user` state so the profile page reflects the new name
without remounting; `changePassword` is fire-and-forget from the context's POV.

### 3. `Frontend/src/services/validators.js` — add two validators

```js
export const validateName = (name) => {
  const v = (name || '').trim()
  if (!v) return 'Name cannot be empty.'
  if (v.length < 2) return 'Please enter your full name.'
  return null
}

export const validatePasswordChange = ({ next, confirm }) => {
  const errors = {}
  if (!next) errors.next = 'New password is required.'
  else if (next.length < 8) errors.next = 'Use at least 8 characters.'
  if (!confirm) errors.confirm = 'Please confirm your new password.'
  else if (next !== confirm) errors.confirm = 'Passwords do not match.'
  return errors
}
```

Order: required → min 8 chars → new === confirm.

### 4. `Frontend/src/App.jsx` — add `ProtectedRoute` and `/profile` route

```jsx
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, bootstrapping } = useAuth()
  if (bootstrapping) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}
```

Mirrors the existing `GuestRoute` shape (returns `null` during bootstrap so we
don't redirect-flash before the session has rehydrated). Add the route inside
`<Routes>`:

```jsx
<Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
```

Import `Profile` from `./pages/Profile`.

### 5. `Frontend/src/components/auth/Navbar.jsx` — add Profile link when authed

Currently the authed nav shows only "Sign out". Add a `NavLink` to `/profile`
before the Sign-out button (and the matching mobile entry inside the `{open && ...}`
block). Reuse the existing `linkClass` styling.

```jsx
{isAuthenticated && (
  <NavLink to="/profile" className={linkClass} end>Profile</NavLink>
)}
```

Same entry inside the mobile dropdown, with `onClick={() => setOpen(false)}`.

### 6. `Frontend/src/pages/Profile.jsx` — NEW page (the main work)

**Top-level layout**

```jsx
<div className="mx-auto w-full max-w-[560px] px-4 py-8 sm:py-12 space-y-6">
  <header>
    <h1 className="text-xl font-semibold text-slate-100">Account</h1>
    <p className="mt-1 text-sm text-slate-400">Manage your profile and security.</p>
  </header>
  <AccountCard ... />
  <PasswordCard ... />
</div>
```

**Component structure** (single file, internal split per spec):

- `Profile` (default export) — reads `useAuth()` and `useToast()`, owns nothing
  but the data-flow plumbing. Passes:
  - `user`, `onUpdateName(name) → Promise` to `AccountCard`
  - `onChangePassword({ newPassword }) → Promise` to `PasswordCard`
- `AccountCard` — owns inline-edit `editing`, `nameValue`, `nameError`, `saving`.
- `PasswordCard` — owns `open`, `form { next, confirm }`, `errors`, `submitting`.

Sub-components are local (not extracted into separate files) — they wouldn't be
reused, and the spec says "Only the top-level component touches `AuthContext`
and the toast hook."

**AccountCard contents** (reuse `Card` from `components/ui/Card.jsx`):

- Avatar: `<div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15 text-violet-200 font-semibold">JS</div>`
  Initials = first letters of the first two whitespace-separated tokens of `user.name`, uppercased.
- Header row (flex): avatar → name + email column → verification badge.
  - Below 640px the row stacks (`flex-col sm:flex-row`) per spec.
  - Name: `text-base font-medium text-slate-100` + `Pencil` icon button (lucide-react)
    with `aria-label="Edit name"`, only visible when not editing.
  - Email: `text-sm text-slate-400` (muted).
  - Badge: green `text-emerald-300 bg-emerald-500/10 border border-emerald-500/30` with
    `BadgeCheck` icon if `is_verified`, else amber `text-amber-200 bg-amber-500/10 border border-amber-500/30` with `ShieldAlert` — small `rounded-full px-2 py-0.5 text-xs`.
- Inline edit row (replaces name when editing):
  - `<Input>` pre-filled with current name + Cancel (ghost) + Save (primary) buttons.
  - Save disabled when `nameValue.trim() === user.name || !nameValue.trim() || saving`.
  - Empty submit shows inline `nameError` via Input's `error` prop (no toast for empty).
  - On success: `toast.success('Name updated successfully')`, collapse, reset state.
  - On server error: keep form open with typed value, show toast error.
  - Form wrapper has `aria-live="polite"`.
- Divider: `<hr className="my-5 border-white/5" />`.
- Two-column metadata grid (`grid-cols-1 sm:grid-cols-2 gap-4`):
  - "Member since" — `formatDate(user.created_at)`
  - "Last updated" — `formatDate(user.updated_at)` (em dash `'—'` if undefined,
    handles older sessions hydrated before the `UserOut` schema change).

`formatDate` helper (top of file):
```js
const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(d)
}
```

**PasswordCard contents** (reuse `Card`):

- Compact (default) state: heading "Password", subtext "Change your account password.",
  right-aligned "Change password" button (`Button` ghost variant) with `<Lock>` icon
  and `gap-2`.
- Expanded state: two stacked `<Input type="password">` (New, Confirm),
  helper text under New: `<p className="mt-1 text-xs text-slate-500">At least 8 characters</p>`,
  Cancel (ghost) + Update (primary) buttons.
- Submit handler:
  ```js
  const errs = validatePasswordChange(form)
  setErrors(errs)
  if (Object.keys(errs).length) return
  setSubmitting(true)
  try {
    await onChangePassword({ newPassword: form.next })
    toast.success('Password changed successfully')
    setForm({ next: '', confirm: '' })
    setErrors({})
    setOpen(false)
  } catch (err) {
    toast.error(err.message || 'Could not change password.')
  } finally {
    setSubmitting(false)
  }
  ```
- Cancel resets `form`, `errors`, and `open=false`.
- Server error preserves the typed values (don't reset on catch).
- Form has `aria-live="polite"`.

**Styling discipline:**
- Tailwind only, single quotes, no semicolons, function components, 2-space indent
  (matches existing files like `Login.jsx`).
- Reuse existing primitives — `Card`, `Button`, `Input` from `components/ui/`.
  `Input` already supports `error`, `label`, password toggle.
- Use the existing palette (`slate-*`, `violet-*`, `ink-*`, `surface` class via Card).
  The frontend-design skill mentions `gray-*`/`indigo-*` as generic guidance, but the
  actual project uses `slate-*` + `violet-*` — match existing files.
- Icons from `lucide-react`: `Pencil`, `Lock`, `BadgeCheck`, `ShieldAlert`, `Check`, `X`.

**Files referenced for reuse (existing — do not re-create):**
- `Frontend/src/components/ui/Card.jsx:1-10` — surface card wrapper
- `Frontend/src/components/ui/Input.jsx:1-59` — input with label/error/password toggle
- `Frontend/src/components/ui/Button.jsx:1-38` — primary/ghost button with loading state
- `Frontend/src/services/api.js:9-47` — `apiFetch` already supports `token` and `method: 'PATCH'`

---

## Files modified / created summary

| File | Change |
|------|--------|
| `Backend/app/account/schemas.py` | Add `UserUpdate`; add `updated_at` to `UserOut` |
| `Backend/app/account/services.py` | Add `update_user_name` |
| `Backend/app/account/routers.py` | Add `PATCH /account/me` route + imports |
| `Frontend/src/services/mockAuth.js` | Add `updateName`, `changePassword` exports |
| `Frontend/src/context/AuthContext.jsx` | Add `updateName`, `changePassword` to context |
| `Frontend/src/services/validators.js` | Add `validateName`, `validatePasswordChange` |
| `Frontend/src/App.jsx` | Add `ProtectedRoute` + `/profile` route |
| `Frontend/src/components/auth/Navbar.jsx` | Add Profile NavLink (desktop + mobile) when authed |
| `Frontend/src/pages/Profile.jsx` | **NEW** — full profile page per spec |

No new dependencies. No new CSS files. No `sqlite.db` reset required.

---

## Verification

### Backend (run from `Backend/`)

```bash
uv run fastapi dev app/main.py
```

Then in another terminal, log in to grab a token, and:

```bash
# PATCH /account/me happy path
curl -X PATCH http://localhost:8000/account/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Display Name"}'
# → 200, body includes updated_at refreshed

# Empty name
curl -X PATCH http://localhost:8000/account/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}'
# → 400 {"detail":"Name cannot be empty"}

# No auth
curl -X PATCH http://localhost:8000/account/me \
  -H "Content-Type: application/json" -d '{"name":"X"}'
# → 401

# /me reflects new name + updated_at
curl http://localhost:8000/account/me -H "Authorization: Bearer <token>"
```

### Frontend (run from `Frontend/`)

```bash
npm run dev
```

Walk through the DoD checklist:

- [ ] Visit `/profile` while logged out → redirected to `/login`.
- [ ] Visit `/profile` while logged in → page renders, Network shows no extra `/me` call beyond the bootstrap one.
- [ ] Account card shows correct name, email, verification badge, member-since, last-updated (en-IN format).
- [ ] Click pencil → inline edit appears with name pre-filled. Save disabled when unchanged.
- [ ] Submit empty name → inline error, no network request.
- [ ] Submit valid new name → `PATCH /account/me` in Network tab → toast → displayed name updates instantly, last-updated refreshes.
- [ ] Click "Change password" → form expands. Click again or Cancel → collapses, fields cleared.
- [ ] Submit empty password fields → inline `aria-live` errors, no network.
- [ ] New password under 8 chars → inline error.
- [ ] New !== Confirm → inline error.
- [ ] Valid submit → `POST /account/change-password?new_password=...` in Network tab → success toast → form clears + collapses.
- [ ] Backend rejects "same as old" → toast error, form stays open with typed values.
- [ ] Navbar shows "Profile" link only when authenticated, in both desktop and mobile menus.
- [ ] Resize below 640px → avatar stacks above name; metadata grid drops to single column.
- [ ] No `npm install` was run; `git diff` shows no `package.json`/`pyproject.toml` changes.

### Lint

```bash
cd Frontend && npm run lint
```

Should pass with zero new warnings.
