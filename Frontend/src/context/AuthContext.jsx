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
