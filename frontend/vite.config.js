import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from main.jsx, which also reloads the page when a new version takes over.
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'AlerteAgri',
        short_name: 'AlerteAgri',
        description: 'Alertes, conseils et marché pour les producteurs agricoles du Bénin',
        lang: 'fr',
        theme_color: '#008751',
        background_color: '#f7f6f1',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The presentation video is a file, not a page of the app.
        navigateFallbackDenylist: [/^\/demo\//],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The French subset of Montserrat is precached; accented local-language subsets are cached on first use.
        globPatterns: ['**/*.{js,css,html,svg}', 'assets/montserrat-base-*.woff2'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'polices', expiration: { maxEntries: 6, maxAgeSeconds: 365 * 86400 } },
          },
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
