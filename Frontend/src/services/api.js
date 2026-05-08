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
