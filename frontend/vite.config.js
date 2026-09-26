import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'AlerteAgri',
        short_name: 'AlerteAgri',
        description: 'Alertes, conseils et marché pour les producteurs agricoles du Bénin',
        lang: 'fr',
        theme_color: '#14532d',
        background_color: '#f7f6f1',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(contents|crops|communes|weather|advice|market\/prices|inputs|alerts\/me)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-lecture', networkTimeoutSeconds: 6, expiration: { maxEntries: 200, maxAgeSeconds: 7 * 86400 } },
          },
        ],
      },
    }),
  ],
});
