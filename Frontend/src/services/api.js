const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'aurora.token'

const extractErrorMessage = (body, status) => {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) return body.detail[0]?.msg || 'Validation error.'
  return `Request failed (${status}).`
}

// Attempt a silent token refresh using the httpOnly refresh cookie.
// Returns the new access token string, or null if refresh fails.
// Concurrent callers share a single in-flight request so we don't race
// the backend's refresh-token rotation (which would revoke the cookie
// out from under the parallel callers).
let refreshInflight = null
const tryRefresh = () => {
  if (refreshInflight) return refreshInflight
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_URL}/account/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      const data = await res.json()
      const newToken = data.access_token
      if (!newToken) return null
      localStorage.setItem(TOKEN_KEY, newToken)
      // Notify AuthContext so its in-memory token (used by useAuth().token)
      // stays in sync — otherwise callers keep sending the old token and
      // every request triggers another refresh.
      window.dispatchEvent(
        new CustomEvent('aurora.token-refreshed', { detail: { token: newToken } }),
      )
      return newToken
    } catch {
      return null
    } finally {
      refreshInflight = null
    }
  })()
  return refreshInflight
}

const doFetch = async (path, options = {}, tokenOverride) => {
  const { body, method = 'GET', headers = {}, credentials = 'include', token, ...rest } = options
  const resolvedToken = tokenOverride ?? token

  const isPlainObject = body !== null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)

  const resolvedHeaders = isPlainObject ? { 'Content-Type': 'application/json', ...headers } : { ...headers }
  if (resolvedToken) resolvedHeaders['Authorization'] = `Bearer ${resolvedToken}`

  const fetchOptions = {
    method,
    credentials,
    headers: resolvedHeaders,
    body: isPlainObject ? JSON.stringify(body) : body,
    ...rest,
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, fetchOptions)
  } catch {
    throw new Error('Network error — could not reach server.')
  }
  return res
}

// Coalesce concurrent identical GETs so React StrictMode (and parallel
// callers) don't fire the same request twice. Keyed by method+path+token.
// Only safe for idempotent reads — never coalesce mutations.
const inflightGets = new Map()
// Short-lived response cache: lets a GET fired moments after another
// identical GET (e.g. StrictMode unmount/remount where the original
// already resolved) reuse the result instead of refetching.
const recentGets = new Map() // key -> { value, at }
const RECENT_GET_TTL_MS = 1500

const apiFetchCore = async (path, options = {}) => {
  let res = await doFetch(path, options)

  // On 401, try a silent token refresh then retry once.
  let sessionExpiredReason = null
  if (res.status === 401 && options.token) {
    const newToken = await tryRefresh()
    if (newToken) {
      res = await doFetch(path, options, newToken)
    } else {
      // Refresh failed — session is dead (logged out, deactivated, deleted).
      // Capture the original 401 detail so the UI can explain why.
      try {
        const body = await res.clone().json()
        sessionExpiredReason = extractErrorMessage(body, 401)
      } catch {
        sessionExpiredReason = 'Your session has ended. Please sign in again.'
      }
      if (localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY)
        window.dispatchEvent(
          new CustomEvent('aurora.session-expired', {
            detail: { reason: sessionExpiredReason },
          }),
        )
      }
    }
  }

  if (res.ok) {
    if (res.status === 204) return null
    try { return await res.json() } catch { return null }
  }

  let errorBody
  try { errorBody = await res.json() } catch { errorBody = null }
  const err = new Error(sessionExpiredReason || extractErrorMessage(errorBody, res.status))
  err.status = res.status
  throw err
}

export const apiFetch = (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase()
  if (method !== 'GET') return apiFetchCore(path, options)
  // Key intentionally excludes the token — a refresh mid-flight can swap
  // the token, which would otherwise split one logical request into two
  // and defeat dedup. Auth is enforced server-side regardless.
  const key = `${method} ${path}`
  const existing = inflightGets.get(key)
  if (existing) return existing
  const cached = recentGets.get(key)
  if (cached && Date.now() - cached.at < RECENT_GET_TTL_MS) {
    return Promise.resolve(cached.value)
  }
  const promise = apiFetchCore(path, options)
    .then((value) => {
      recentGets.set(key, { value, at: Date.now() })
      return value
    })
    .finally(() => {
      inflightGets.delete(key)
    })
  inflightGets.set(key, promise)
  return promise
}

export const apiFormPost = (path, fields, options = {}) => {
  const params = new URLSearchParams(fields)
  return apiFetch(path, { method: 'POST', body: params, ...options })
}

// -------------------- Admin --------------------

export const listUsers = ({ page = 1, pageSize = 20, search = '', sortBy = 'created_at', order = 'desc', role, status, token }) => {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  params.set('sort_by', sortBy)
  params.set('order', order)
  const trimmed = (search || '').trim()
  if (trimmed) params.set('search', trimmed)
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  return apiFetch(`/account/admin/users/?${params.toString()}`, { token })
}

export const getUserStats = ({ token }) =>
  apiFetch('/account/admin/users/stats', { token })

export const createUserAsAdmin = ({ name, email, password, isAdmin = false, token }) =>
  apiFetch('/account/admin/users/', {
    method: 'POST',
    body: { name, email, password, is_admin: isAdmin },
    token,
  })

export const downloadUsersCsv = async ({ search = '', role, status, sortBy = 'created_at', order = 'desc', token }) => {
  const params = new URLSearchParams()
  const trimmed = (search || '').trim()
  if (trimmed) params.set('search', trimmed)
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  params.set('sort_by', sortBy)
  params.set('order', order)
  const res = await fetch(`${API_URL}/account/admin/users/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
  if (!res.ok) {
    let detail = `Export failed (${res.status}).`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch { /* not JSON */ }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cd = res.headers.get('Content-Disposition') || ''
  const m = cd.match(/filename="?([^"]+)"?/)
  a.download = m ? m[1] : `users-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const getUserById = ({ userId, token }) =>
  apiFetch(`/account/admin/users/${userId}`, { token })

export const toggleUserActive = ({ userId, token }) =>
  apiFetch(`/account/admin/users/${userId}/toggle-active`, { method: 'PATCH', token })

export const toggleUserAdmin = ({ userId, token }) =>
  apiFetch(`/account/admin/users/${userId}/toggle-admin`, { method: 'PATCH', token })

