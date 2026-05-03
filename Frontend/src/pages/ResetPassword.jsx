import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { validateReset } from '../services/validators'

const ResetPassword = () => {
  const { resetPassword } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validateReset({ email })
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await resetPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      toast.error(err.message || 'Could not send the reset link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={
        sent
          ? 'If an account exists for that email, we just sent reset instructions.'
          : 'Enter your email and we will send you a reset link.'
      }
      footer={
        <Link
          to="/login"
          className="font-medium text-violet-400 hover:text-violet-300"
        >
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="mb-1 text-sm text-slate-400">Sent to</p>
          <p className="mb-6 break-all text-sm font-medium text-white">
            {email}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors({})
            }}
            error={errors.email}
            autoComplete="email"
          />
          <Button type="submit" loading={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

export default ResetPassword
