import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import icon from 'astro-icon';
// import node from '@astrojs/node';

export default defineConfig({
    output: 'server',
    adapter: vercel(),
    integrations: [
        icon()
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});