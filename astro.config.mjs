import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel'; // Cambiamos 'node' por 'vercel'
import icon from 'astro-icon';

export default defineConfig({
  output: 'server', // Mantenemos SSR
  adapter: vercel({
    // Vercel no necesita el "mode: standalone", 
    // el adaptador se encarga de todo automáticamente.
    webAnalytics: { enabled: true } // Opcional: activa analíticas de Vercel
  }),
  security: {
    checkOrigin: false,
  },
  integrations: [
    icon()
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});