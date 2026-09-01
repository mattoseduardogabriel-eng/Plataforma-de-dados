/** @type {import('tailwindcss').Config} */
function withOpacity(variable) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Acento "orbit" — teal/mint. Substitui o antigo indigo em botões,
        // links, foco de formulário, ícones ativos e destaques. 400/500 são
        // constantes entre temas; 300 (texto de acento sobre superfície)
        // é definido por tema via variável CSS — ver src/index.css.
        brand: {
          50: '#ecfdf7',
          100: '#d1faec',
          200: '#a3f3d9',
          300: withOpacity('--brand-300'),
          400: withOpacity('--brand-400'),
          500: withOpacity('--brand-500'),
          600: '#169a70',
          700: '#12795a',
          800: '#0f5f47',
          900: '#0c4b39',
        },
        // Escala neutra dirigida por variáveis CSS: claro em :root, escuro
        // em .dark (ver src/index.css) — assim toda classe já escrita como
        // text-slate-*/bg-slate-*/border-slate-* responde ao tema sem
        // precisar reescrever cada página.
        slate: {
          50: withOpacity('--slate-50'),
          100: withOpacity('--slate-100'),
          200: withOpacity('--slate-200'),
          300: withOpacity('--slate-300'),
          400: withOpacity('--slate-400'),
          500: withOpacity('--slate-500'),
          600: withOpacity('--slate-600'),
          700: withOpacity('--slate-700'),
          800: withOpacity('--slate-800'),
          900: withOpacity('--slate-900'),
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
        card: '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.08)',
        glow: '0 0 40px -10px rgba(34, 192, 140, 0.35)',
      },
    },
  },
  plugins: [],
};
