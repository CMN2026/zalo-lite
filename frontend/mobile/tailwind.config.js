/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'zalo-blue': '#0068FF',
        'zalo-bg': '#F4F5F7',
        'zalo-text': '#1A1A1A',
        'zalo-gray': '#767A7F',
      }
    },
  },
  plugins: [],
}

