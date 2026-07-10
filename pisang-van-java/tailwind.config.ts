/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────────
      // KONVENSI WARNA (dibaca sebelum menambah kelas warna baru)
      //
      // 1. primary / secondary / background / surface / outline / error
      //    → sistem UTAMA. Pakai ini untuk komponen BARU secara default.
      //
      // 2. cream-* / brown-*  → sistem lama, MASIH backbone nyata di 41 file
      //    (mayoritas admin panel). JANGAN migrasi paksa file yang sudah
      //    pakai ini — tapi juga jangan tambah pemakaian baru. Kalau sedang
      //    menyentuh file yang pakai cream/brown untuk alasan lain, boleh
      //    sekalian migrasi bagian yang disentuh ke primary/secondary.
      //
      // 3. amber.brand → SATU-SATUNYA accent color brand (dipakai 34 file,
      //    biasanya untuk CTA/badge/highlight). Jangan pakai amber-500 dkk
      //    dari Tailwind default untuk tujuan yang sama — itu bikin dua
      //    "oranye brand" yang beda di layar yang sama.
      //
      // 4. Tailwind default (zinc-*, dkk) → boleh untuk teks/border/bg netral
      //    yang genuinely tidak butuh identitas brand (mis. skeleton loader,
      //    divider). Jangan pakai untuk apa pun yang harusnya terasa "PVJ".
      // ─────────────────────────────────────────────────────────────
      colors: {
        // Stitch design tokens (Material 3 heritage warm palette)
        primary: '#32170d',
        background: '#fff8f6',
        surface: '#fff8f6',
        'on-surface': '#271812',
        'on-surface-variant': '#504440',
        secondary: '#735c00',
        'on-secondary': '#ffffff',
        'secondary-container': '#fed65b',
        'on-secondary-container': '#745c00',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#fff1ec',
        'surface-container': '#ffe9e2',
        'surface-container-high': '#ffe2d8',
        'outline-variant': '#d5c3bd',
        outline: '#83746f',
        'primary-container': '#4b2c20',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Legacy colors to prevent dashboard compilation issues
        cream: {
          50: '#FDFAF2',
          100: '#FDF6E3',
          200: '#F5E6C8',
          300: '#EDD4A0'
        },
        brown: {
          50: '#F5EDE5',
          100: '#E6CBB3',
          200: '#C4956A',
          300: '#A0522D',
          400: '#7A3B18',
          500: '#6B3A1F',
          600: '#5C2A0A',
          700: '#3D1C02',
          800: '#2A1201',
          900: '#1A0A00'
        },
        amber: {
          brand: '#D4802A'
        },
        green: {
          wa: '#2E7D32',
          'wa-light': '#4CAF50'
        }
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'DM Sans', 'system-ui', 'sans-serif']
      },
      spacing: {
        'unit-xs': '4px',
        'unit-sm': '8px',
        'unit-md': '16px',
        'unit-lg': '24px',
        'margin-page': '2rem',
        gutter: '1.5rem',
        'sidebar-width': '280px',
        'container-max': '1200px'
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.5s ease-out forwards',
        float: 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-30px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' }
        }
      },
      backgroundImage: {
        'hero-pattern':
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1.5' fill='rgba(212,128,42,0.15)'/%3E%3C/svg%3E\")"
      },
      boxShadow: {
        'sbx-card': '0 2px 8px -2px rgba(61, 28, 2, 0.08), 0 1px 2px -1px rgba(61, 28, 2, 0.04)',
        'sbx-nav': '0 1px 0px 0px rgba(61, 28, 2, 0.08)',
        'sbx-frap': '0 4px 12px -2px rgba(61, 28, 2, 0.15), 0 0 0 1px rgba(61, 28, 2, 0.05)'
      }
    }
  },
  plugins: []
}
