/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          50:  '#f5f4f0',
          100: '#e8e5dc',
          200: '#d0cab8',
          300: '#b3a98e',
          400: '#8f8268',
          500: '#6b5f4a',
          600: '#4e4435',
          700: '#332d23',
          800: '#1e1a14',
          900: '#100e0a',
        },
        gold: {
          300: '#f0d080',
          400: '#e8b84b',
          500: '#c99a2e',
          600: '#a07820',
        }
      }
    }
  },
  plugins: []
}
