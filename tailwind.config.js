/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic color aliases for the app
        'app-bg': '#18181b',           // zinc-900
        'app-bg-elevated': '#27272a',  // zinc-800
        'app-bg-subtle': '#1e1e1e',    // Custom between 800-900
        'app-border': '#3f3f46',       // zinc-700
        'app-border-subtle': '#52525b', // zinc-600
        'app-text': '#e4e4e7',         // zinc-200
        'app-text-secondary': '#a1a1aa', // zinc-400
        'app-text-muted': '#71717a',   // zinc-500
        'primary': '#6366f1',          // indigo-500
        'primary-hover': '#4f46e5',    // indigo-600
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}

