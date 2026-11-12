/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  corePlugins: { preflight: false }, // evita que Tailwind pise los estilos de Ionic
  theme: {
    extend: {
      colors: {
        void: '#08080a',
        obsidian: '#111116',
        hairline: '#22222a',
        peach: '#ff7e5f',
        ambient: '#ffa07a',
        dawn: '#f8ad9d',
        blush: '#ffb4a2',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        halo: '0 0 40px -10px rgba(255,126,95,0.35)',
      },
    },
  },
  plugins: [],
};
