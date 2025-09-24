/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <-- Esto es clave
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'card-dark': '#1f2937', // gris oscuro estilo ChatGPT
        'bg-dark': '#121212',
        'text-dark': '#d1d5db',
      },
    },
  },
  plugins: [],
}
