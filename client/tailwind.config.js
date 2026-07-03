/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        enviro: {
          50: '#eefbf0',
          100: '#CDFFCD',
          200: '#B7FFA6',
          300: '#A6D191',
          400: '#64a34b',
          500: '#217344',
          600: '#1b6038',
          700: '#154c2d',
          800: '#103d24',
          900: '#0d321e',
          950: '#061c10',
        },
        ocean: {
          50: '#eef0fd',
          100: '#dbe0fa',
          200: '#bdc5f4',
          300: '#94a2ec',
          400: '#6c7de2',
          500: '#4656d0',
          600: '#3440b2',
          700: '#2c3590',
          800: '#252d75',
          900: '#1a206b',
          950: '#0E0E52',
        },
        dark: {
          50: '#f5f6f9',
          100: '#eceef4',
          200: '#d3d7e5',
          300: '#aeb6ce',
          400: '#838eb3',
          500: '#5c6892',
          600: '#48527a',
          700: '#394062',
          800: '#2b314d',
          900: '#0E0E52',
          950: '#07072E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s linear infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
