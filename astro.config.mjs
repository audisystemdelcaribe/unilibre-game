import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel'; // Cambiamos 'node' por 'vercel'
import icon from 'astro-icon';

export default defineConfig({
    site: 'https://unilibre-game.vercel.app',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true } 
  }),
  security: {
    checkOrigin: true,
  },
  integrations: [
    icon()
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});