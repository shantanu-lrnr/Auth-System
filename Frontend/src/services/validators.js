export const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())

export const validateLogin = ({ email, password }) => {
  const errors = {}
  if (!email) errors.email = 'Email is required.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Password is required.'
  return errors
}

export const validateRegister = ({ name, email, password, confirm }) => {
  const errors = {}
  if (!name || name.trim().length < 2)
    errors.name = 'Please enter your full name.'
  if (!email) errors.email = 'Email is required.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Password is required.'
  else if (password.length < 8)
    errors.password = 'Use at least 8 characters.'
  if (!confirm) errors.confirm = 'Please confirm your password.'
  else if (password !== confirm) errors.confirm = 'Passwords do not match.'
  return errors
}

export const validateReset = ({ email }) => {
  const errors = {}
  if (!email) errors.email = 'Email is required.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'
  return errors
}
