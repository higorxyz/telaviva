const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', ...fontFamily.sans],
      },
      colors: {
        primary: "#101010",
        secondary: "#bd0003",
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      keyframes: {
        'float-1': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(-2px, -2px)' },
        },
        'float-2': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(-1px, -1px)' },
        },
        'float-3': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(1px, 1px) scale(1.05)' },
        },
      },
      animation: {
        'float-1': 'float-1 8s ease-in-out infinite',
        'float-2': 'float-2 8s ease-in-out infinite 0.2s',
        'float-3': 'float-3 8s ease-in-out infinite 0.4s',
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
};


