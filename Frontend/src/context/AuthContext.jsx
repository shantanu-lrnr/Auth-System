import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as mockAuth from '../services/mockAuth'
import { useToast } from './ToastContext'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('aurora.token'))
  const [bootstrapping, setBootstrapping] = useState(true)
  const [revalidating, setRevalidating] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // getSession() already coalesces concurrent calls — but StrictMode's
      // mount/unmount/mount runs them sequentially. The first sets state,
      // the second is a wasted /me. Skip when we already have a user.
      if (user) {
        setBootstrapping(false)
        return
      }
      const session = await mockAuth.getSession()
      if (cancelled) return
      if (session) {
        setUser(session.user)
        setToken(session.token)
      } else {
        setUser(null)
        setToken(null)
      }
      setBootstrapping(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If apiFetch detects a dead session (401 + refresh failed), it removes the
  // token and dispatches this event. We mirror that in React state so route
  // guards bounce the user to /login on the next render, and surface the
  // server's reason (e.g. "Account is no longer active") as a toast.
  useEffect(() => {
    const onExpired = (e) => {
      setUser(null)
      setToken(null)
      const reason = e?.detail?.reason
      if (reason) toast.error(reason)
    }
    const onRefreshed = (e) => {
      const newToken = e?.detail?.token
      if (newToken) setToken(newToken)
    }
    window.addEventListener('aurora.session-expired', onExpired)
    window.addEventListener('aurora.token-refreshed', onRefreshed)
    return () => {
      window.removeEventListener('aurora.session-expired', onExpired)
      window.removeEventListener('aurora.token-refreshed', onRefreshed)
    }
  }, [toast])

  const login = async (credentials) => {
    const session = await mockAuth.login(credentials)
    setUser(session.user)
    setToken(session.token)
    return session
  }

  const register = async (payload) => {
    const { user } = await mockAuth.register(payload)
    return { user }
  }

  const logout = async () => {
    await mockAuth.logout()
    setUser(null)
    setToken(null)
  }

  const resetPassword = (payload) => mockAuth.resetPassword(payload)

  const updateName = async (name) => {
    const updated = await mockAuth.updateName({ name, token })
    setUser(updated)
    return updated
  }

  const changePassword = async ({ newPassword }) =>
    mockAuth.changePassword({ newPassword, token })

  const requestAccountDeletion = async ({ password }) => {
    await mockAuth.requestAccountDeletion({ password, token })
    localStorage.removeItem('aurora.token')
    setUser(null)
    setToken(null)
  }

  // Re-fetch the current user. If the session is dead, apiFetch will fire
  // 'aurora.session-expired' which our listener already handles.
  const revalidateSession = async () => {
    if (!token) return
    setRevalidating(true)
    try {
      const session = await mockAuth.getSession()
      if (session) setUser(session.user)
    } catch {
      // apiFetch already cleared the token + fired the event on a real 401.
      // For other errors (network etc.) we keep the existing session.
    } finally {
      setRevalidating(false)
    }
  }

  const requestVerification = async () =>
    mockAuth.requestVerification({ token })

  const verifyEmail = async (verifyToken) => {
    const result = await mockAuth.verifyEmail({ token: verifyToken })
    if (token) {
      const session = await mockAuth.getSession()
      if (session) setUser(session.user)
    }
    return result
  }

  const listUsers = (params = {}) => mockAuth.listUsers({ ...params, token })
  const getUserById = (userId) => mockAuth.getUserById({ userId, token })
  const toggleUserActive = (userId) => mockAuth.toggleUserActive({ userId, token })
  const toggleUserAdmin = (userId) => mockAuth.toggleUserAdmin({ userId, token })
  const getUserStats = () => mockAuth.getUserStats({ token })
  const createUserAsAdmin = (payload) => mockAuth.createUserAsAdmin({ ...payload, token })
  const downloadUsersCsv = (filters = {}) => mockAuth.downloadUsersCsv({ ...filters, token })

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      bootstrapping,
      revalidating,
      login,
      register,
      logout,
      resetPassword,
      updateName,
      changePassword,
      requestAccountDeletion,
      revalidateSession,
      requestVerification,
      verifyEmail,
      listUsers,
      getUserById,
      toggleUserActive,
      toggleUserAdmin,
      getUserStats,
      createUserAsAdmin,
      downloadUsersCsv,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, bootstrapping, revalidating],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
