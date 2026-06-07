/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './validando-voto/index.html',
    './src/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        bunker: {
          bg:   '#07071a',
          card: '#0d0d24',
        },
      },
    },
  },
  plugins: [],
}
