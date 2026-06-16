import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Backend API proxy target (default 3000; backend must run on this port for proxy to work)
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

// Only expose NODE_ENV and VITE_-prefixed vars to the client. The previous
// `'process.env': process.env` inlined the ENTIRE build environment into the
// bundle (size bloat + risk of leaking server-only secrets). process.env stays
// defined as an object so any `process.env.X` reference resolves to undefined
// rather than throwing.
const clientProcessEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('VITE_')),
  ),
};

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  define: {
    'process.env': clientProcessEnv
  },
  resolve: {
    // Single React instance — avoids duplicate context (e.g. useAuth sees no provider)
    dedupe: ['react', 'react-dom'],
    // exceljs main entry is Node-oriented; the browser dist works in the client and
    // avoids Vite / optimizeDeps pre-bundle failures (Failed to fetch module).
    alias: {
      exceljs: path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js'),
    },
  },
  optimizeDeps: {
    include: ['exceljs'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['opsy_favicon.png'],
      manifest: {
        name: 'Opsy',
        short_name: 'Opsy',
        description: 'HomeOps property management',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['index.html'],
        navigateFallback: '/index.html',
        // Backend endpoints reached via full-page navigation (OAuth start + callbacks,
        // calendar integration redirects) must hit the server, NOT be served the SPA
        // shell. Without this denylist the service worker intercepts e.g.
        // /auth/google/signin and renders the SPA 404 instead of redirecting to Google.
        // Note: /auth/callback is a real frontend route, so we only deny /auth/google/*.
        navigateFallbackDenylist: [
          /^\/auth\/google\//,
          /^\/calendar-integrations\//,
        ],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: {
      // Don't proxy /auth/callback - it's a frontend SPA route. The backend redirects there
      // after OAuth; Vite must serve the React app, not the backend's built index.html.
      '/auth': {
        target: API_PROXY_TARGET,
        bypass: (req) => (req.url?.startsWith('/auth/callback') ? '/index.html' : undefined),
      },
      // Stripe redirects to /billing/success after checkout; serve SPA, don't proxy to API
      '/billing': {
        target: API_PROXY_TARGET,
        bypass: (req) => (req.url?.startsWith('/billing/success') ? '/index.html' : undefined),
      },
      '/mfa': API_PROXY_TARGET,
      '/users': API_PROXY_TARGET,
      '/accounts': API_PROXY_TARGET,
      '/contacts': API_PROXY_TARGET,
      '/properties': API_PROXY_TARGET,
      '/systems': API_PROXY_TARGET,
      '/maintenance': API_PROXY_TARGET,
      '/documents': API_PROXY_TARGET,
      '/propertyDocuments': API_PROXY_TARGET,
      '/subscriptions': API_PROXY_TARGET,
      '/subscription-products': API_PROXY_TARGET,
      '/invitations': API_PROXY_TARGET,
      '/engagement': API_PROXY_TARGET,
      '/analytics': API_PROXY_TARGET,
      '/predict': API_PROXY_TARGET,
      '/professional-categories': API_PROXY_TARGET,
      '/professionals': API_PROXY_TARGET,
      '/maintenance-events': API_PROXY_TARGET,
      '/saved-professionals': API_PROXY_TARGET,
      '/support-tickets': API_PROXY_TARGET,
      '/resources': API_PROXY_TARGET,
      '/communications': API_PROXY_TARGET,
      '/notifications': API_PROXY_TARGET,
      '/email-delivery': API_PROXY_TARGET,
      '/agencies-admin': API_PROXY_TARGET,
      '/affiliations': API_PROXY_TARGET,
      '/affiliation-requests': API_PROXY_TARGET,
      '/coupons': API_PROXY_TARGET,
      '/calendar-integrations': API_PROXY_TARGET,
      '/conversations': API_PROXY_TARGET,
      '/homeowner-agent-inquiries': API_PROXY_TARGET,
      '/stagedDocuments': API_PROXY_TARGET,
      '/document-analysis': API_PROXY_TARGET,
      '/inspection-analysis': API_PROXY_TARGET,
      '/inspection-checklist': API_PROXY_TARGET,
      '/ai': API_PROXY_TARGET,
      '/webhooks': API_PROXY_TARGET,
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Split large/independent vendors into their own chunks so the initial
        // entry stays small and heavy libs are only fetched by the routes that
        // actually use them (charts, rich-text editors, spreadsheet parsers).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'vendor-router';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'vendor-charts';
          }
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-editor';
          }
          if (id.includes('/xlsx/')) return 'vendor-xlsx';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('/moment/')) return 'vendor-moment';
          if (id.includes('lucide-react')) return 'vendor-icons';
          return undefined;
        },
      },
    },
  }
});
