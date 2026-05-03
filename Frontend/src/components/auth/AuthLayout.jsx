import Card from '../ui/Card'

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="flex flex-1 items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <Card>
        <div className="-mx-6 -mt-6 mb-6 rounded-t-xl border-b border-violet-400/15 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-indigo-500/10 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-6">
          <h1 className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-violet-200/70">{subtitle}</p>
          )}
        </div>
        {children}
      </Card>
      {footer && (
        <div className="mt-4 text-center text-sm text-slate-400">{footer}</div>
      )}
    </div>
  </div>
)

export default AuthLayout
