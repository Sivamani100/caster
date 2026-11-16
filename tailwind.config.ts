import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#e94560',
          purple: '#8b5cf6',
          dark: '#0a0a0f',
          panel: '#13131f',
          border: '#1e1e30',
        }
      },
    },
  },
  plugins: [],
}

export default config
