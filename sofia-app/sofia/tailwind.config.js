/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#faf8f4', 100: '#f7f5f0', 200: '#f0ece4', 300: '#e8e4dc', 400: '#d5cfc4', 500: '#b0a898', 600: '#8a8478', 700: '#6b6358', 800: '#5a5347', 900: '#2c2a25' },
        ink: { 50: '#f0ece4', 100: '#c8c2b8', 500: '#1a1a2e', 600: '#15152a', 700: '#101025', 800: '#0b0b1e', 900: '#060617' },
        gold: { 300: '#e8c87a', 400: '#d4a84e', 500: '#b08540', 600: '#96703a' },
        cat: {
          decision: '#6b5ce7',
          brainstorm: '#e8a838',
          shopping: '#3dba7a',
          observation: '#4a9edd',
          draft: '#d45d79',
        }
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
