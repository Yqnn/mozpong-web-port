import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base keeps the compiled docs working from any GitHub Pages
  // project path (for example /mozpong/ or /mozpong-web-port/).
  base: './',
  build: {
    outDir: 'docs',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MozPong',
        short_name: 'MozPong',
        description: 'MozPong 1.0.5 - Classic Mac-style arcade game',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,png,ico,webmanifest,wav,json,rsrc,ttf}',
        ],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
