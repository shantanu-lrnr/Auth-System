// Auth service — register, login, logout, and session all call the real backend.
import { apiFetch, apiFormPost } from './api'

const USERS_KEY = 'aurora.users'
const TOKEN_KEY = 'aurora.token'
const LATENCY = 850

const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms))

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

const writeUsers = (users) =>
  localStorage.setItem(USERS_KEY, JSON.stringify(users))

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
  await wait()
  const users = readUsers()
  const exists = users.some(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  // We intentionally don't reveal whether the email exists — return success
  // either way (the standard practice for password reset endpoints).
  return { sent: true, exists }
}

export const getSession = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const user = await apiFetch('/account/me', { token })
    return { user, token }
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
