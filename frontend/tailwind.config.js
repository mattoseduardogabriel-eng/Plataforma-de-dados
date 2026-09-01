/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Acento "orbit" — teal/mint. Substitui o antigo indigo em botões,
        // links, foco de formulário, ícones ativos e destaques.
        brand: {
          50: '#ecfdf7',
          100: '#d1faec',
          200: '#a3f3d9',
          300: '#6ee7c4',
          400: '#3ddbaa',
          500: '#22c08c',
          600: '#169a70',
          700: '#12795a',
          800: '#0f5f47',
          900: '#0c4b39',
        },
        // Paleta "night" — reaproveita a escala `slate` do Tailwind, mas
        // invertida (50 = quase preto, 900 = quase branco), para que todo
        // texto/borda escrito como text-slate-*/border-slate-* nas telas
        // já existentes passe a funcionar em tema escuro sem precisar
        // reescrever cada classe individualmente.
        slate: {
          50: '#05080a',
          100: '#0a0f13',
          200: '#131a1f',
          300: '#1f282e',
          400: '#3a454b',
          500: '#66757a',
          600: '#8b9a9d',
          700: '#aebcbc',
          800: '#d3dcda',
          900: '#f2f7f5',
        },
      },
      backgroundImage: {
        'star-field':
          'radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 90px 80px, rgba(255,255,255,0.25), transparent), radial-gradient(1.5px 1.5px at 160px 40px, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 220px 120px, rgba(255,255,255,0.2), transparent), radial-gradient(1.5px 1.5px at 280px 20px, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 340px 90px, rgba(255,255,255,0.25), transparent)',
      },
      backgroundSize: {
        stars: '380px 160px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.24), 0 1px 3px 0 rgb(0 0 0 / 0.3)',
        glow: '0 0 40px -10px rgba(34, 192, 140, 0.35)',
      },
    },
  },
  plugins: [],
};
