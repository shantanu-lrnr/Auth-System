import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as mockAuth from '../services/mockAuth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    const session = mockAuth.getSession()
    if (session) {
      setUser(session.user)
      setToken(session.token)
    }
    setBootstrapping(false)
  }, [])

  const login = async (credentials) => {
    const session = await mockAuth.login(credentials)
    setUser(session.user)
    setToken(session.token)
    return session
  }

  const register = async (payload) => {
    const session = await mockAuth.register(payload)
    setUser(session.user)
    setToken(session.token)
    return session
  }

  const logout = async () => {
    await mockAuth.logout()
    setUser(null)
    setToken(null)
  }

  const resetPassword = (payload) => mockAuth.resetPassword(payload)

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      bootstrapping,
      login,
      register,
      logout,
      resetPassword,
    }),
    [user, token, bootstrapping],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
