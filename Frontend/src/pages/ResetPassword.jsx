import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useToast } from '../context/ToastContext'
import { validatePasswordChange } from '../services/validators'
import { confirmPasswordReset } from '../services/mockAuth'

const ResetPassword = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      toast.error('Reset link is invalid or missing a token.')
      return
    }
    const errs = validatePasswordChange(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await confirmPasswordReset({ token, newPassword: form.next })
      toast.success('Password reset. Please sign in.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not reset your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={
        <Link
          to="/login"
          className="font-medium text-violet-400 hover:text-violet-300"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={form.next}
          onChange={onChange('next')}
          error={errors.next}
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Re-enter your new password"
          value={form.confirm}
          onChange={onChange('confirm')}
          error={errors.confirm}
          autoComplete="new-password"
        />
        <Button type="submit" loading={submitting}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ResetPassword
