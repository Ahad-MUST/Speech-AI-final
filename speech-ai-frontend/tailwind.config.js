module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // PsyConTech Brand Colors
        psycon: {
          // Primary Colors
          'mint': {
            DEFAULT: '#5AE8C7',
            50: '#E8FDF9',
            100: '#D1FBF3',
            200: '#A3F7E7',
            300: '#75F3DB',
            400: '#47EFCF',
            500: '#5AE8C7', // Main Mint Teal
            600: '#2EE0B4',
            700: '#25B896',
            800: '#1C8B71',
            900: '#135E4C',
          },
          'purple': {
            DEFAULT: '#DF72E8',
            50: '#FCF0FD',
            100: '#F9E1FB',
            200: '#F3C3F7',
            300: '#EDA5F3',
            400: '#E787EF',
            500: '#DF72E8', // Main Orchid Purple
            600: '#D154E0',
            700: '#B63AC4',
            800: '#8F2D97',
            900: '#68206A',
          },
          'yellow': {
            DEFAULT: '#FFC700',
            50: '#FFF9E0',
            100: '#FFF3C1',
            200: '#FFE783',
            300: '#FFDB45',
            400: '#FFCF07',
            500: '#FFC700', // Main Vibrant Yellow
            600: '#E0AC00',
            700: '#B8900',
            800: '#996F00',
            900: '#7A5500',
          },
          // Secondary Colors
          'light-teal': {
            DEFAULT: '#B7F0DE',
            50: '#F0FDF9',
            100: '#E1FBF3',
            200: '#C3F7E7',
            300: '#B7F0DE', // Main Light Teal
            400: '#8DE8CC',
            500: '#63E0BA',
            600: '#39D8A8',
            700: '#2BB386',
            800: '#228E64',
            900: '#1A6942',
          },
          'lavender': {
            DEFAULT: '#EBD4F2',
            50: '#FDF9FE',
            100: '#FAF3FD',
            200: '#F5E7FB',
            300: '#EBD4F2', // Main Lavender
            400: '#DFC1E9',
            500: '#D3AEE0',
            600: '#C79BD7',
            700: '#B47CC4',
            800: '#9862A1',
            900: '#7C487E',
          },
          'soft-yellow': {
            DEFAULT: '#FFF3B0',
            50: '#FFFEF5',
            100: '#FFFCEB',
            200: '#FFF9D7',
            300: '#FFF3B0', // Main Soft Yellow
            400: '#FFED99',
            500: '#FFE782',
            600: '#FFE16B',
            700: '#FFD740',
            800: '#E0BC00',
            900: '#B89700',
          }
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}