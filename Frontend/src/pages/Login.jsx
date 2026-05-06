import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { validateLogin } from '../services/validators'

const Login = () => {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validateLogin(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const { user } = await login(form)
      toast.success(`Welcome back, ${user.name?.split(' ')[0] || 'friend'}.`)
      navigate('/profile', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Please enter your details."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-violet-400 hover:text-violet-300"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={onChange('email')}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={onChange('password')}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-ink-900 text-violet-500 focus:ring-1 focus:ring-violet-500"
            />
            Remember me
          </label>
          <Link
            to="/reset-password"
            className="font-medium text-violet-400 hover:text-violet-300"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}

export default Login
