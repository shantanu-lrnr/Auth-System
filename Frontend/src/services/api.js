const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const extractErrorMessage = (body, status) => {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) return body.detail[0]?.msg || 'Validation error.'
  return `Request failed (${status}).`
}

export const apiFetch = async (path, options = {}) => {
  const { body, method = 'GET', headers = {}, credentials = 'include', ...rest } = options

  const isPlainObject = body !== null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof URLSearchParams)

  const fetchOptions = {
    method,
    credentials,
    headers: isPlainObject ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: isPlainObject ? JSON.stringify(body) : body,
    ...rest,
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, fetchOptions)
  } catch {
    throw new Error('Network error — could not reach server.')
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
