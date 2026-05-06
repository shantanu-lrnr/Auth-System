import { useState } from 'react'
import { BadgeCheck, Lock, Pencil, ShieldAlert } from 'lucide-react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  validateName,
  validatePasswordChange,
} from '../services/validators'

const formatDate = (iso) => {
  if (!iso) return '—'
  // Append Z if no timezone offset present so JS treats the value as UTC
  const normalized = /[Z+\-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(d)
}

const initialsOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || ''
  const second = parts[1]?.[0] || ''
  return (first + second).toUpperCase()
}

const AccountCard = ({ user, onUpdateName, onSuccess, onError }) => {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(user.name)
  const [nameError, setNameError] = useState(null)
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setNameValue(user.name)
    setNameError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setNameError(null)
    setNameValue(user.name)
  }

  const trimmed = nameValue.trim()
  const unchanged = trimmed === user.name
  const saveDisabled = unchanged || !trimmed || saving

  const onSubmit = async (e) => {
    e.preventDefault()
    const err = validateName(nameValue)
    if (err) {
      setNameError(err)
      return
    }
    setSaving(true)
    try {
      await onUpdateName(trimmed)
      onSuccess('Name updated successfully')
      setEditing(false)
      setNameError(null)
    } catch (e2) {
      onError(e2.message || 'Could not update name.')
    } finally {
      setSaving(false)
    }
  }

  const verified = Boolean(user.is_verified)

  return (
    <Card>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-200"
        >
          {initialsOf(user.name)}
        </div>

        <div className="min-w-0 flex-1">
          {!editing ? (
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-medium text-slate-100">
                {user.name}
              </p>
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit name"
                className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              aria-live="polite"
              className="space-y-2"
            >
              <Input
                label="Display name"
                value={nameValue}
                onChange={(e) => {
                  setNameValue(e.target.value)
                  if (nameError) setNameError(null)
                }}
                error={nameError}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancel}
                  className="!w-auto !px-3 !py-1.5 !text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={saveDisabled}
                  className="!w-auto !px-3 !py-1.5 !text-xs"
                >
                  Save
                </Button>
              </div>
            </form>
          )}
          {!editing && (
            <p className="mt-1 truncate text-sm text-slate-400">
              {user.email}
            </p>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            verified
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          {verified ? (
            <BadgeCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          {verified ? 'Verified' : 'Unverified'}
        </span>
      </div>

      <hr className="my-5 border-white/5" />

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Member since
          </dt>
          <dd className="mt-1 text-sm text-slate-200">
            {formatDate(user.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Last updated
          </dt>
          <dd className="mt-1 text-sm text-slate-200">
            {formatDate(user.updated_at)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

const PasswordCard = ({ onChangePassword, onSuccess, onError }) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const reset = () => {
    setForm({ next: '', confirm: '' })
    setErrors({})
  }

  const cancel = () => {
    reset()
    setOpen(false)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validatePasswordChange(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await onChangePassword({ newPassword: form.next })
      onSuccess('Password changed successfully')
      reset()
      setOpen(false)
    } catch (err) {
      onError(err.message || 'Could not change password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-slate-100">Password</h2>
          <p className="mt-1 text-sm text-slate-400">
            Change your account password.
          </p>
        </div>
        {!open && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="!w-auto shrink-0 !px-3 !py-1.5 !text-xs"
          >
            <Lock className="h-3.5 w-3.5" />
            Change password
          </Button>
        )}
      </div>

      {open && (
        <form
          onSubmit={onSubmit}
          aria-live="polite"
          className="mt-5 space-y-4"
        >
          <div>
            <Input
              label="New password"
              type="password"
              value={form.next}
              onChange={onChange('next')}
              error={errors.next}
              autoComplete="new-password"
            />
            {!errors.next && (
              <p className="mt-1 text-xs text-slate-500">
                At least 8 characters
              </p>
            )}
          </div>
          <Input
            label="Confirm new password"
            type="password"
            value={form.confirm}
            onChange={onChange('confirm')}
            error={errors.confirm}
            autoComplete="new-password"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              className="!w-auto !px-3 !py-1.5 !text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="!w-auto !px-3 !py-1.5 !text-xs"
            >
              Update
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

const Profile = () => {
  const { user, updateName, changePassword } = useAuth()
  const toast = useToast()

  if (!user) return null

  const onSuccess = (msg) => toast.success(msg)
  const onError = (msg) => toast.error(msg)

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Account</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your profile and security.
        </p>
      </header>
      <div className="space-y-6">
        <AccountCard
          user={user}
          onUpdateName={updateName}
          onSuccess={onSuccess}
          onError={onError}
        />
        <PasswordCard
          onChangePassword={changePassword}
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    </div>
  )
}

export default Profile
