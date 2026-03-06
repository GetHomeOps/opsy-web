import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend API proxy target (default 3000; backend must run on this port for proxy to work)
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  define: {
    'process.env': process.env
  },
  plugins: [react()],
  server: {
    proxy: {
      '/auth': API_PROXY_TARGET,
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
      '/inspection-analysis': API_PROXY_TARGET,
      '/ai': API_PROXY_TARGET,
      '/billing': API_PROXY_TARGET,
      '/webhooks': API_PROXY_TARGET,
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    }
  }
});
