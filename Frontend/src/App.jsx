import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuroraBackground from './components/auth/AuroraBackground'
import Navbar from './components/auth/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Profile from './pages/Profile'
import AdminPanel from './pages/AdminPanel'
import { useAuth } from './context/AuthContext'

const GuestRoute = ({ children }) => {
  const { isAuthenticated, bootstrapping } = useAuth()
  if (bootstrapping) return null
  return isAuthenticated ? <Navigate to="/profile" replace /> : children
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, bootstrapping, revalidating, revalidateSession } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (isAuthenticated) revalidateSession()
    // Re-check whenever the user navigates between protected pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  if (bootstrapping || revalidating) return null
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, bootstrapping, revalidating, revalidateSession } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (isAuthenticated) revalidateSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  if (bootstrapping || revalidating) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/profile" replace />
  return children
}

const App = () => (
  <>
    <AuroraBackground />
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  </>
)

export default App
