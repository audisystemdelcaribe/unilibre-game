import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
    // Fuerza a Astro a actuar como un servidor real
    output: 'server',
    adapter: node({
        mode: 'standalone',
    }),
    integrations: [svelte()],
    vite: {
        plugins: [tailwindcss()],
        server: {
            fs: {
                allow: ['.']
            },
            host: 'localhost'
        },
        optimizeDeps: {
            exclude: ['@supabase/ssr']
        }
    },
});