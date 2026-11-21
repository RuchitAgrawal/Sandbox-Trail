/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#010102',
        surface: {
          1: '#0d0e11',
          2: '#16181d',
          3: '#21232a',
          4: '#2b2d35',
        },
        hairline: {
          DEFAULT: '#23252a',
          strong: '#32353d',
        },
        ink: {
          DEFAULT: '#f7f8f8',
          muted: '#d0d6e0',
          subtle: '#8a8f98',
          tertiary: '#62666d',
        },
        primary: {
          DEFAULT: '#5e6ad2',
          hover: '#828fff',
          focus: '#5e69d1',
        },
        raft: {
          leader: '#10b981',
          candidate: '#f59e0b',
          follower: '#64748b',
          crashed: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};
