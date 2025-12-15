/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{astro,mdx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        paper: 'var(--paper)',
        rule: 'var(--rule)',
        accent: 'var(--accent)',
      },
      boxShadow: {
        paper: 'var(--shadow)',
      },
      fontFamily: {
        body: 'var(--font-body)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      screens: {
        'ultra': '1440px',
      },
    },
  },
  plugins: [],
};
