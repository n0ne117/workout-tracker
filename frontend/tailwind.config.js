/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Gray palette driven by CSS variables so dark mode can swap to sepia
        // without touching any JSX. Light-mode values are identical to Tailwind defaults.
        gray: {
          50:  'rgb(var(--gray-50)  / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--gray-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
