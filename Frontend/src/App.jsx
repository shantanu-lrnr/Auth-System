import { Routes, Route, Navigate } from 'react-router-dom'
import AuroraBackground from './components/auth/AuroraBackground'
import Navbar from './components/auth/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import { useAuth } from './context/AuthContext'

const GuestRoute = ({ children }) => {
  const { isAuthenticated, bootstrapping } = useAuth()
  if (bootstrapping) return null
  return isAuthenticated ? <Navigate to="/" replace /> : children
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  </>
)

export default App
