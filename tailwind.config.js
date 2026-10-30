/** @type {import('tailwindcss').Config} */

// Les couleurs sont des variables CSS (voir src/global.css) : un seul nom de classe
// (ex. `bg-bg`) suit automatiquement le thème clair ou sombre.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: token('bg'), // fond crème
        surface: token('surface'), // cartes
        line: token('line'), // séparateurs
        ink: token('ink'), // texte principal
        muted: token('muted'), // texte secondaire
        sage: token('sage'), // positif
        'sage-soft': token('sage-soft'),
        coral: token('coral'), // alertes
        'coral-soft': token('coral-soft'),
        amber: token('amber'), // avertissement (budget > 80 %)
        'on-accent': token('on-accent'), // texte sur fond sauge
      },
    },
  },
  plugins: [],
};
