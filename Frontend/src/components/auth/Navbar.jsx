import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const GUEST_LINKS = [
  { to: '/login', label: 'Sign in' },
  { to: '/register', label: 'Register' },
]

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 text-sm rounded-md transition-colors ${
    isActive
      ? 'text-white bg-white/5'
      : 'text-slate-400 hover:text-white hover:bg-white/5'
  }`

const Navbar = () => {
  const [open, setOpen] = useState(false)
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  const navLinks = isAuthenticated ? [] : GUEST_LINKS

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-100"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500 text-white text-xs font-bold">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight">Authflow</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end>
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <>
              <NavLink to="/profile" className={linkClass} end>
                Profile
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm rounded-md transition-colors text-slate-400 hover:text-white hover:bg-white/5"
              >
                Sign out
              </button>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 sm:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/5 px-4 py-2 sm:hidden">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-white bg-white/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <>
              <NavLink
                to="/profile"
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                Profile
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors text-slate-400 hover:text-white hover:bg-white/5"
              >
                Sign out
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

export default Navbar
