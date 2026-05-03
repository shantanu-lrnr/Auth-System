import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const Input = forwardRef(function Input(
  { label, type = 'text', error, className = '', ...rest },
  ref,
) {
  const id = useId()
  const [showPwd, setShowPwd] = useState(false)
  const isPassword = type === 'password'
  const effectiveType = isPassword && showPwd ? 'text' : type

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-medium text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={effectiveType}
          {...rest}
          className={`block w-full rounded-md border bg-ink-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors ${
            error
              ? 'border-rose-500/60 focus:border-rose-400'
              : 'border-white/10 focus:border-violet-400'
          } ${isPassword ? 'pr-10' : ''}`}
          autoComplete={rest.autoComplete}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-200"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-rose-400">{error}</p>
      )}
    </div>
  )
})

export default Input
