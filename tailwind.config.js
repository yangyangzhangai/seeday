/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        pageIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        highlightPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' },
          '50%':      { boxShadow: '0 0 12px 4px rgba(74, 222, 128, 0.4)' },
        },
      },
      animation: {
        'pageIn': 'pageIn 0.18s ease-out',
      },
    },
  },
  plugins: [],
}