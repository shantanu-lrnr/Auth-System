import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { validateRegister } from '../services/validators'

const Register = () => {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = validateRegister(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const { user } = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}.`)
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-violet-400 hover:text-violet-300"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={onChange('name')}
          error={errors.name}
          autoComplete="name"
        />
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
          placeholder="At least 8 characters"
          value={form.password}
          onChange={onChange('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Re-enter your password"
          value={form.confirm}
          onChange={onChange('confirm')}
          error={errors.confirm}
          autoComplete="new-password"
        />
        <Button type="submit" loading={submitting}>
          Create account
        </Button>
        <p className="text-center text-xs text-slate-500">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  )
}

export default Register
