/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
    './src/renderer/callout.html',
  ],
  theme: {
    extend: {
      colors: {
        // Premium palettes
        onyx: '#0C0C0C', // Deep Onyx background
        graphite: '#1A1A1A', // Card/bubble in dark mode
        'emerald-mist': '#10B981', // Accent for local speaker bubbles
        studio: '#F9FAFB', // Clean Studio background
        'studio-card': '#FFFFFF', // Light cards
        'slate-ink': '#1F2937', // Primary text in light mode
        'sky-glow': '#38BDF8', // Sky-blue accent for light mode
      },
      boxShadow: {
        'soft-card': '0 20px 50px -25px rgba(0,0,0,0.35)',
      },
      keyframes: {
        'bubble-in': {
          '0%': { opacity: 0, transform: 'translateY(8px) scale(0.99)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'bubble-in': 'bubble-in 220ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
