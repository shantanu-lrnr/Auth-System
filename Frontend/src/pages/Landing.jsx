import { Link } from 'react-router-dom'
import { ShieldCheck, RefreshCw, KeyRound } from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    desc: 'Passwords hashed with Argon2. Access tokens expire in 15 minutes.',
  },
  {
    icon: RefreshCw,
    title: 'Refresh token rotation',
    desc: 'Every refresh issues a new token and revokes the old one automatically.',
  },
  {
    icon: KeyRound,
    title: 'Full auth flows',
    desc: 'Register, login, email verification, and password reset — all included.',
  },
]

const Landing = () => {
  const { isAuthenticated } = useAuth()
  return (
  <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
      Full-stack auth system
    </div>

    <h1 className="max-w-xl bg-gradient-to-br from-white to-violet-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
      Authentication,{' '}
      <span className="text-violet-400">done right</span>
    </h1>

    <p className="mt-4 max-w-md text-base text-slate-400">
      A working JWT auth system with refresh-token rotation, email verification,
      and password reset — built with FastAPI and React.
    </p>

    {!isAuthenticated && (
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link to="/register" className="sm:w-44">
          <Button>Get started</Button>
        </Link>
        <Link to="/login" className="sm:w-44">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </div>
    )}

    <div className="mt-20 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
      {features.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className="surface rounded-xl p-6 text-left"
        >
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-sm text-slate-400">{desc}</p>
        </div>
      ))}
    </div>
  </main>
  )
}

export default Landing
