---
name: auth-ui-designer
description: >
  Generates modern, production-ready React + Tailwind UI components and pages
  for the Auth-System project (github.com/shantanu-lrnr/Auth-System).
  Trigger this skill whenever the user asks to design, create, build, redesign,
  or improve any page or component for the Auth System — including phrases like
  "design the ___ page", "create UI for ___", "build component for ___",
  "redesign ___", "make a ___ screen", or "stub out the ___ page". Also trigger
  when the user asks for UI improvements, layout changes, or new frontend
  features for this project, even without explicit design keywords.
---

# Auth System — Frontend UI Designer

Generates clean, consistent, production-ready React + Tailwind components and
pages for the Auth-System project.

---

## 1. Project Context

**Repo:** `https://github.com/shantanu-lrnr/Auth-System`

**Frontend stack (pinned — do not deviate):**
- React 19, React Router 7, Vite 8
- Tailwind CSS 3 (utility classes only — no CSS files, no CSS-in-JS)
- framer-motion (animations)
- lucide-react (icons)
- Function components + hooks only. No classes, no TypeScript.
- Single quotes, no semicolons, 2-space indent

**Directory layout:**
```
Frontend/src/
  main.jsx                     # Mounts BrowserRouter > ToastProvider > AuthProvider > App
  App.jsx                      # Routes: /login, /register, /reset-password, /forgot-password, /
  context/AuthContext.jsx      # useAuth(): { user, token, isAuthenticated, login, register, logout }
  context/ToastContext.jsx     # useToast(): success/error notifications
  services/validators.js       # Form validation helpers
  components/auth/             # AuthLayout, Navbar, AuroraBackground
  components/ui/               # Button, Card, Input primitives
  pages/                       # Login, Register, ResetPassword, ForgotPassword, Landing
```

**Existing pages (implemented):** Landing, Login, Register, ForgotPassword
**Stub pages (safe to implement):** ResetPassword, VerifyEmail, ChangePassword, Profile

---

## 2. Design System

### Theme
- **Dark background:** `bg-gray-950` or `bg-gray-900`
- **Aurora accent:** The `AuroraBackground` component wraps auth pages — reuse it for new auth pages
- **Cards:** `bg-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-xl`
- **Text primary:** `text-white`
- **Text secondary/muted:** `text-gray-400`
- **Accent color:** Indigo/violet gradient — `from-indigo-500 to-violet-600`

### Spacing & Layout
- **8px grid** — use Tailwind's `p-2/4/6/8`, `gap-2/4/6/8`, `space-y-4/6`
- **Rounded corners:** `rounded-xl` for inputs/buttons, `rounded-2xl` for cards
- **Max width for auth forms:** `max-w-md w-full mx-auto`
- **Full-page auth layout:** `min-h-screen flex items-center justify-center`

### Buttons
```jsx
// Primary
<button className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-violet-600
  hover:from-indigo-600 hover:to-violet-700 text-white font-medium rounded-xl
  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">

// Secondary / ghost
<button className="w-full py-2.5 px-4 border border-gray-600 text-gray-300
  hover:border-gray-400 hover:text-white rounded-xl transition-all duration-200">
```

### Inputs
```jsx
<input className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600
  rounded-xl text-white placeholder-gray-400 focus:outline-none
  focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
```

### Icons
- Use `lucide-react` throughout
- Common icons: `Mail`, `Lock`, `Eye`, `EyeOff`, `User`, `ArrowRight`, `CheckCircle`, `AlertCircle`, `LogOut`, `Settings`, `Shield`
- Size: `className="w-4 h-4"` inline with text, `"w-5 h-5"` standalone
- Muted color in inputs: `text-gray-400`

---

## 3. Code Patterns

### Page shell (auth pages)
```jsx
import { AuroraBackground } from '../components/auth/AuroraBackground'

export default function MyPage() {
  return (
    <AuroraBackground>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="bg-gray-800/60 backdrop-blur-md border border-gray-700/50
          rounded-2xl shadow-xl p-8 w-full max-w-md">
          {/* content */}
        </div>
      </div>
    </AuroraBackground>
  )
}
```

### Form pattern
```jsx
const [form, setForm] = useState({ email: '', password: '' })
const [errors, setErrors] = useState({})
const [submitting, setSubmitting] = useState(false)
const { showToast } = useToast()
const { login } = useAuth()

const handleSubmit = async (e) => {
  e.preventDefault()
  const validationErrors = validateForm(form)  // from services/validators.js
  if (Object.keys(validationErrors).length) return setErrors(validationErrors)
  setSubmitting(true)
  try {
    await login(form)
    showToast('Success!', 'success')
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    setSubmitting(false)
  }
}
```

### Inline field error
```jsx
{errors.email && (
  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
    <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
  </p>
)}
```

### framer-motion entry animation (use on cards/forms)
```jsx
import { motion } from 'framer-motion'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
```

---

## 4. Workflow

### Step 1 — Gather context
Before generating, identify:
- **What** is being built (page name, component name)
- **Any constraints** the user mentioned (data shape, auth state, API endpoint)
- **Which stub route** this connects to (check section 5 of CLAUDE.md if available)

If the user hasn't described the page at all, ask one focused question:
> "What should this page do / what data does it show?"

Do NOT ask for screenshots of existing design — infer from the design system above.

### Step 2 — Output structure
Always deliver in this order:

#### UI Structure
- 3–5 bullet layout overview
- Key UX decisions (e.g. "password toggle shown", "error shown inline not toast")

#### Code
- Single `.jsx` file, default export
- Modular — extract sub-components only if they'd realistically be reused
- All imports at the top (React hooks, lucide icons, contexts, router)
- No placeholder `// TODO` comments unless explicitly flagging a stub backend call

#### Design Notes (optional, brief)
- Only if there's a non-obvious decision worth explaining

### Step 3 — Consistency check
Before finalising, verify:
- [ ] Uses `AuroraBackground` (for auth pages)
- [ ] Dark theme throughout — no `bg-white` or light surfaces
- [ ] Tailwind only — no inline styles, no CSS files
- [ ] `lucide-react` for all icons
- [ ] Imports match existing project structure
- [ ] Function component + hooks, single quotes, no semicolons

---

## 5. What to Avoid
- Generic "starter template" look — no `bg-blue-500` buttons, no plain white cards
- Unstructured code dumps — always structure with the UI/Code/Notes format above
- Guessing at API shape — if a backend call is needed and the shape is unclear, note it as a comment
- Adding new packages — stick to what's already installed (React 19, Tailwind 3, framer-motion, lucide-react, React Router 7)
- TypeScript, CSS modules, styled-components — this project is plain JS + Tailwind