/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        retro: ['"Space Grotesk"', 'monospace'],
      },
      colors: {
        theme: {
          sky: 'var(--bg-sky)',
          panel: 'var(--bg-panel)',
          surface: 'var(--bg-surface)',
          ink: 'var(--ink)',
          inkBorder: 'var(--ink-border)',
          sakura: 'var(--sakura)',
          peach: 'var(--peach)',
          mint: 'var(--mint)',
          matcha: 'var(--matcha)',
          teal: 'var(--teal)',
          text: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          primary: 'var(--action-primary)',
          border: 'var(--border-primary)',
        }
      },
      boxShadow: {
        manga: '3px 3px 0px var(--ink-border)',
        'manga-lg': '5px 5px 0px var(--ink-border)',
        'manga-sm': '2px 2px 0px var(--ink-border)',
        'manga-lift': '4px 6px 0px var(--ink-border)',
      }
    },
  },
  plugins: [],
}
