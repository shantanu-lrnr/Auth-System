import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  UserCheck,
  UserPlus,
  ShieldCheck,
  EyeOff,
  Eye,
  Loader2,
  Plus,
  Download,
  X,
  AlertCircle,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isEmail } from '../services/validators'

const PAGE_SIZE = 10

const formatJoined = (iso) => {
  if (!iso) return '—'
  const normalized = /[Z+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

const initialsOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

const AVATAR_PALETTE = [
  'bg-violet-500/20 text-violet-200',
  'bg-emerald-500/20 text-emerald-200',
  'bg-sky-500/20 text-sky-200',
  'bg-amber-500/20 text-amber-200',
  'bg-rose-500/20 text-rose-200',
  'bg-fuchsia-500/20 text-fuchsia-200',
  'bg-teal-500/20 text-teal-200',
  'bg-orange-500/20 text-orange-200',
]
const hashIndex = (str, mod) => {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

const Avatar = ({ name }) => (
  <div
    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_PALETTE[hashIndex(name, AVATAR_PALETTE.length)]}`}
  >
    {initialsOf(name)}
  </div>
)

const StatusPill = ({ user }) => {
  if (user.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Inactive
    </span>
  )
}

const RolePill = ({ user }) =>
  user.is_admin ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-200">
      <ShieldCheck className="h-3 w-3" />
      Admin
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300">
      User
    </span>
  )

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-xl border border-white/5 bg-ink-800/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{value ?? '—'}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
)

const SortableHeader = ({ column, label, sortBy, order, onSort, align = 'left' }) => {
  const active = sortBy === column
  return (
    <th
      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-400 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 transition-colors hover:text-slate-200"
      >
        {label}
        {active ? (
          order === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

const RowIconButton = ({ icon: Icon, title, onClick, disabled, tone = 'neutral' }) => {
  const toneClass = {
    neutral: 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
    danger: 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-200',
    success: 'text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200',
  }[tone]
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/[0.02] ${toneClass}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-xl border border-white/10 bg-ink-900 py-2.5 pl-3 pr-9 text-sm text-slate-200 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {label}: {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
  </div>
)

const buildPageList = (page, totalPages) => {
  // Returns an array of numbers and '...' to render. Always shows first/last and the window around current.
  const pages = new Set([1, totalPages, page, page - 1, page + 1])
  const ordered = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < ordered.length; i++) {
    if (i > 0 && ordered[i] - ordered[i - 1] > 1) out.push('...')
    out.push(ordered[i])
  }
  return out
}

const validateNewUser = ({ name, email, password }) => {
  const errors = {}
  if (!name || name.trim().length < 2) errors.name = 'Name must be at least 2 characters'
  if (!isEmail(email)) errors.email = 'Enter a valid email'
  if (!password || password.length < 8) errors.password = 'At least 8 characters'
  return errors
}

const AddUserDialog = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', isAdmin: false })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key) => (e) => {
    const val = key === 'isAdmin' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: val }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validateNewUser(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await onCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        isAdmin: form.isAdmin,
      })
      onClose()
    } catch (err) {
      const msg = err?.message || 'Could not create user.'
      if (/email/i.test(msg)) {
        setErrors((er) => ({ ...er, email: msg }))
      } else {
        setErrors((er) => ({ ...er, _form: msg }))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Add user</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Creates an account with the given initial password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" aria-live="polite">
          <Input
            label="Name"
            value={form.name}
            onChange={onChange('name')}
            error={errors.name}
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={onChange('email')}
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Initial password"
            type="password"
            value={form.password}
            onChange={onChange('password')}
            error={errors.password}
            autoComplete="new-password"
          />

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={onChange('isAdmin')}
              className="h-4 w-4 rounded border-white/20 bg-ink-900 text-violet-500 focus:ring-violet-400"
            />
            Grant admin role
          </label>

          {errors._form && (
            <p className="flex items-center gap-1 text-sm text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" /> {errors._form}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="!w-auto !px-4 !py-2 !text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="!w-auto !px-4 !py-2 !text-xs"
            >
              Create user
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const AdminPanel = () => {
  const {
    user: currentUser,
    listUsers,
    toggleUserActive,
    toggleUserAdmin,
    getUserStats,
    createUserAsAdmin,
    downloadUsersCsv,
  } = useAuth()
  const toast = useToast()
  const [showAddUser, setShowAddUser] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionInFlight, setActionInFlight] = useState(null)

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [order, setOrder] = useState('desc')

  // Debounce search -> searchTerm; reset to page 1 on change
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const refetchStats = useCallback(async () => {
    try {
      const s = await getUserStats()
      setStats(s)
    } catch {
      // stats are best-effort; don't toast a failure
    }
  }, [getUserStats])

  const refetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: searchTerm,
        sortBy,
        order,
        role: role || undefined,
        status: status || undefined,
      })
      setUsers(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.error(err.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [listUsers, page, searchTerm, sortBy, order, role, status, toast])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await listUsers({
          page,
          pageSize: PAGE_SIZE,
          search: searchTerm,
          sortBy,
          order,
          role: role || undefined,
          status: status || undefined,
        })
        if (cancelled) return
        setUsers(res.items)
        setTotal(res.total)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Could not load users.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, sortBy, order, role, status])

  useEffect(() => {
    refetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSort = (column) => {
    if (sortBy === column) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setOrder('asc')
    }
    setPage(1)
  }

  const onRoleChange = (v) => { setRole(v); setPage(1) }
  const onStatusChange = (v) => { setStatus(v); setPage(1) }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadUsersCsv({
        search: searchTerm,
        role: role || undefined,
        status: status || undefined,
        sortBy,
        order,
      })
      toast.success('Export downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const handleCreateUser = async (payload) => {
    await createUserAsAdmin(payload)
    toast.success(`${payload.name} created`)
    await Promise.all([refetchList(), refetchStats()])
  }

  const runAction = async (fn, userId, fallbackMsg) => {
    setActionInFlight(userId)
    try {
      const res = await fn(userId)
      toast.success(res?.msg || fallbackMsg)
      await Promise.all([refetchList(), refetchStats()])
    } catch (err) {
      toast.error(err.message || 'Action failed.')
    } finally {
      setActionInFlight(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageList = useMemo(() => buildPageList(page, totalPages), [page, totalPages])
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(total, page * PAGE_SIZE)

  if (!currentUser) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">User management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search, sort, and manage all registered users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleExport}
            loading={exporting}
            className="!w-auto !px-4 !py-2 !text-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="!w-auto !px-4 !py-2 !text-sm"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </header>

      {showAddUser && (
        <AddUserDialog
          onClose={() => setShowAddUser(false)}
          onCreate={handleCreateUser}
        />
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={stats?.total} accent="bg-violet-500/15 text-violet-300" />
        <StatCard icon={UserCheck} label="Active Users" value={stats?.active} accent="bg-emerald-500/15 text-emerald-300" />
        <StatCard icon={ShieldCheck} label="Admins" value={stats?.admins} accent="bg-sky-500/15 text-sky-300" />
        <StatCard icon={UserPlus} label="New This Month" value={stats?.new_this_month} accent="bg-amber-500/15 text-amber-300" />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-white/10 bg-ink-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
          />
        </div>
        <FilterSelect
          label="Role"
          value={role}
          onChange={onRoleChange}
          options={[{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={onStatusChange}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-ink-800/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/5 bg-white/[0.02]">
              <tr>
                <SortableHeader column="name" label="User" sortBy={sortBy} order={order} onSort={onSort} />
                <SortableHeader column="email" label="Email" sortBy={sortBy} order={order} onSort={onSort} />
                <SortableHeader column="is_active" label="Status" sortBy={sortBy} order={order} onSort={onSort} />
                <SortableHeader column="is_admin" label="Role" sortBy={sortBy} order={order} onSort={onSort} />
                <SortableHeader column="created_at" label="Joined" sortBy={sortBy} order={order} onSort={onSort} />
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-400">
                    No users found.
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) => {
                  const isSelf = u.id === currentUser.id
                  const isOtherAdmin = u.is_admin && !isSelf
                  const disabled = actionInFlight === u.id || isSelf || isOtherAdmin
                  const disabledTitle = isSelf
                    ? "You can't act on your own account"
                    : isOtherAdmin
                      ? 'Cannot act on another admin'
                      : ''

                  return (
                    <tr key={u.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-slate-100">{u.name}</span>
                              {isSelf && (
                                <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] uppercase text-violet-200">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{u.email}</td>
                      <td className="px-3 py-3"><StatusPill user={u} /></td>
                      <td className="px-3 py-3"><RolePill user={u} /></td>
                      <td className="px-3 py-3 text-slate-400">
                        <div className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {formatJoined(u.created_at)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <RowIconButton
                            icon={u.is_active ? EyeOff : Eye}
                            title={disabled ? disabledTitle : u.is_active ? 'Deactivate user' : 'Activate user'}
                            disabled={disabled}
                            onClick={() => runAction(toggleUserActive, u.id, 'Status updated')}
                          />
                          <RowIconButton
                            icon={ShieldCheck}
                            title={disabled ? disabledTitle : u.is_admin ? 'Revoke admin' : 'Grant admin'}
                            disabled={disabled}
                            onClick={() => runAction(toggleUserAdmin, u.id, 'Role updated')}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-400">
            Showing {rangeStart} to {rangeEnd} of {total} users
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageList.map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-2 text-xs text-slate-500">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs transition-colors ${
                    p === page
                      ? 'bg-violet-500 text-white'
                      : 'border border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPanel
