import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as mockAuth from '../services/mockAuth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('aurora.token'))
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
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
  }, [])

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
      login,
      register,
      logout,
      resetPassword,
      updateName,
      changePassword,
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
    [user, token, bootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
