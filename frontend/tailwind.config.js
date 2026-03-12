/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        card: '#1a1a1a',
        border: '#2a2a2a',
        'quadrant-leading': '#064e3b',
        'quadrant-weakening': '#713f12',
        'quadrant-lagging': '#7f1d1d',
        'quadrant-improving': '#1e3a5f',
      },
    },
  },
  plugins: [],
}