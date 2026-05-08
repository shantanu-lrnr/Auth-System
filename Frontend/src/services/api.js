const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'aurora.token'

const extractErrorMessage = (body, status) => {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) return body.detail[0]?.msg || 'Validation error.'
  return `Request failed (${status}).`
}

// Attempt a silent token refresh using the httpOnly refresh cookie.
// Returns the new access token string, or null if refresh fails.
const tryRefresh = async () => {
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
    return newToken
  } catch {
    return null
  }
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

export const apiFetch = async (path, options = {}) => {
  let res = await doFetch(path, options)

  // On 401, try a silent token refresh then retry once.
  if (res.status === 401 && options.token) {
    const newToken = await tryRefresh()
    if (newToken) {
      res = await doFetch(path, options, newToken)
    }
  }

  if (res.ok) {
    if (res.status === 204) return null
    try { return await res.json() } catch { return null }
  }

  let errorBody
  try { errorBody = await res.json() } catch { errorBody = null }
  const err = new Error(extractErrorMessage(errorBody, res.status))
  err.status = res.status
  throw err
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

