/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0b0b10',
          900: '#101017',
          800: '#16161f',
          700: '#1d1d28',
        },
      },
    },
  },
  plugins: [],
}
