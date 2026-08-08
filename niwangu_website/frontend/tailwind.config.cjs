/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sandstone: '#FFF0F3',
        midnight: '#4A3B42',
        // `sage` is decorative only: white text on it is 3.08:1, below the
        // 4.5:1 WCAG AA threshold. Use `sageDeep` (5.87:1) whenever the surface
        // carries text.
        sage: '#F06292',
        sageDeep: '#C2185B',
        sageLight: '#F8BBD0',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
