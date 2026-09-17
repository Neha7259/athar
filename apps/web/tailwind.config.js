/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Athar brand — deep desert green + sand
        athar: {
          50: '#f2f7f4',
          100: '#dcebe2',
          500: '#1f6f4a',
          600: '#185a3c',
          700: '#12452e',
          900: '#0a2a1c',
        },
      },
    },
  },
  plugins: [],
};
