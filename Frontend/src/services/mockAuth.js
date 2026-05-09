// Auth service — register, login, logout, and session all call the real backend.
import { apiFetch, apiFormPost } from './api'

const TOKEN_KEY = 'aurora.token'

export const register = async ({ name, email, password }) => {
  const user = await apiFetch('/account/register', {
    method: 'POST',
    body: { name, email, password },
  })
  return { user }
}

export const login = async ({ email, password }) => {
  const { access_token } = await apiFormPost('/account/login', { username: email, password })
  localStorage.setItem(TOKEN_KEY, access_token)
  const user = await apiFetch('/account/me', { token: access_token })
  // Prime the session cache so the Navbar / ProtectedRoute revalidate that
  // fires immediately after navigation doesn't trigger a redundant /me.
  sessionCache = { user, token: access_token, at: Date.now() }
  return { user, token: access_token }
}

export const logout = async () => {
  try {
    await apiFetch('/account/logout', { method: 'POST' })
  } finally {
    localStorage.removeItem(TOKEN_KEY)
    sessionCache = null
  }
}

export const resetPassword = async ({ email }) => {
  await apiFetch(
    `/account/forget-password?email=${encodeURIComponent(email)}`,
    { method: 'POST' },
  )
  return { sent: true }
}

export const confirmPasswordReset = async ({ token, newPassword }) =>
  apiFetch(
    `/account/reset-password?token=${encodeURIComponent(token)}&new_password=${encodeURIComponent(newPassword)}`,
    { method: 'POST' },
  )

export const requestVerification = async ({ token }) =>
  apiFetch('/account/verify-request', { method: 'POST', token })

export const verifyEmail = async ({ token }) =>
  apiFetch(`/account/verify?token=${encodeURIComponent(token)}`, { method: 'GET' })

// Coalesce concurrent getSession() calls (StrictMode double-mount, parallel
// guard revalidations) and cache the result briefly so that calls firing
// back-to-back after login/navigation share a single /me round-trip.
let sessionInflight = null
let sessionCache = null // { user, token, at }
const SESSION_CACHE_MS = 2000
export const getSession = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return Promise.resolve(null)
  if (sessionCache && sessionCache.token === token && Date.now() - sessionCache.at < SESSION_CACHE_MS) {
    return Promise.resolve({ user: sessionCache.user, token: sessionCache.token })
  }
  if (sessionInflight) return sessionInflight
  sessionInflight = (async () => {
    try {
      const user = await apiFetch('/account/me', { token })
      // Token may have been silently refreshed inside apiFetch; read the current value.
      const activeToken = localStorage.getItem(TOKEN_KEY)
      sessionCache = { user, token: activeToken, at: Date.now() }
      return { user, token: activeToken }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      sessionCache = null
      return null
    } finally {
      sessionInflight = null
    }
  })()
  return sessionInflight
}

export const updateName = async ({ name, token }) =>
  apiFetch('/account/me', { method: 'PATCH', body: { name }, token })

export const changePassword = async ({ newPassword, token }) =>
  apiFetch(
    `/account/change-password?new_password=${encodeURIComponent(newPassword)}`,
    { method: 'POST', token },
  )

export const requestAccountDeletion = async ({ password, token }) =>
  apiFetch('/account/delete-request', {
    method: 'POST',
    body: { password },
    token,
  })

export {
  listUsers,
  getUserById,
  toggleUserActive,
  toggleUserAdmin,
  getUserStats,
  createUserAsAdmin,
  downloadUsersCsv,
} from './api'
