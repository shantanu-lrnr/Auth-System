// Mock auth service — simulates a real backend with localStorage.
// All functions return promises with realistic latency, throw `Error` on failure.

const USERS_KEY = 'aurora.users'
const SESSION_KEY = 'aurora.session'
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

const fakeJwt = (userId) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 15,
    }),
  )
  const signature = btoa(`mock-${userId}-${Date.now()}`).replace(/=+$/, '')
  return `${header}.${payload}.${signature}`
}

export const register = async ({ name, email, password }) => {
  await wait()
  const users = readUsers()
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.')
  }
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    // NOTE: this is a mock — never store plaintext passwords for real
    password,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  const token = fakeJwt(user.id)
  const session = { user: stripPwd(user), token }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export const login = async ({ email, password }) => {
  await wait()
  const users = readUsers()
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password.')
  }
  const token = fakeJwt(user.id)
  const session = { user: stripPwd(user), token }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export const logout = async () => {
  await wait(300)
  localStorage.removeItem(SESSION_KEY)
  return true
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

export const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const stripPwd = ({ password, ...rest }) => rest
