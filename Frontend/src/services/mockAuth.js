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
  return { user, token: access_token }
}

export const logout = async () => {
  try {
    await apiFetch('/account/logout', { method: 'POST' })
  } finally {
    localStorage.removeItem(TOKEN_KEY)
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

export const getSession = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const user = await apiFetch('/account/me', { token })
    // Token may have been silently refreshed inside apiFetch; read the current value.
    const activeToken = localStorage.getItem(TOKEN_KEY)
    return { user, token: activeToken }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
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
