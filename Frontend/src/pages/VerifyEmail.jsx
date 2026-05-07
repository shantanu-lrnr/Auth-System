import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const VerifyEmail = () => {
  const { verifyEmail, isAuthenticated } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [error, setError] = useState(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!token) {
      setError('This verification link is missing a token.')
      return
    }

    ;(async () => {
      try {
        await verifyEmail(token)
        toast.success('Email verified successfully')
        navigate(isAuthenticated ? '/profile' : '/login', { replace: true })
      } catch (err) {
        setError(err.message || 'Could not verify your email.')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!error) return null

  return (
    <AuthLayout
      title="Verification failed"
      subtitle={error}
      footer={
        <Link
          to={isAuthenticated ? '/profile' : '/login'}
          className="font-medium text-violet-400 hover:text-violet-300"
        >
          {isAuthenticated ? 'Back to your profile' : 'Back to sign in'}
        </Link>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <XCircle className="h-6 w-6" />
        </div>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmail
