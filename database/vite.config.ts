import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Parse hostname from VITE_APP_URL (e.g. "http://platform.ktnbs.com:8080" → "platform.ktnbs.com")
  const appUrl = env.VITE_APP_URL || '';
  const appHost = appUrl ? new URL(appUrl.startsWith('http') ? appUrl : `http://${appUrl}`).hostname : '';
  const allowedHosts = ['localhost', '127.0.0.1', ...(appHost ? [appHost] : [])];

  return {
  base: '/',
  server: {
    host: true,
    port: 8080,
    // Don't override hmr.host — Vite auto-detects from the browser's URL.
    // Forcing host: appHost breaks local dev (HMR tries ws://platform.ktnbs.com:8080
    // from localhost, fails, and triggers endless location.reload() loops).
    hmr: { overlay: false },
    allowedHosts,
    proxy: {
      // Forward /api/ to XAMPP on port 80
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/flowstack' + path,
        // Tell PHP the real public hostname so getBaseUrl() returns correct tracking URLs
        headers: appHost ? { 'X-Forwarded-Host': appHost } : {},
      },
      // Forward /uploads/ to XAMPP for file access in dev
      '/uploads': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/flowstack' + path,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    // Enable gzip compression
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // ── Keep react + fullcalendar together to avoid circular deps ──
          if (id.includes('@fullcalendar')) return 'vendor-fullcalendar';

          // ── Core framework ──
          if (id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/react/')) return 'vendor-react';

          // ── Charts ──
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';

          // ── Data fetching ──
          if (id.includes('@tanstack')) return 'vendor-query';

          // ── Icons ──
          if (id.includes('lucide-react')) return 'vendor-icons';

          // ── All Radix primitives ──
          if (id.includes('@radix-ui')) return 'vendor-radix';

          // ── Spreadsheet / export ──
          if (id.includes('xlsx') || id.includes('jspdf')) return 'vendor-xlsx';

          // ── Forms + validation ──
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'vendor-form';

          // ── Carousel / embla ──
          if (id.includes('embla')) return 'vendor-carousel';

          // ── Date + style utilities ──
          if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-utils';

          // ── Small UI libs ──
          if (id.includes('sonner') || id.includes('cmdk') || id.includes('react-day-picker') || id.includes('react-resizable-panels') || id.includes('vaul')) return 'vendor-misc';

          // ── Everything else from node_modules ──
          return 'vendor-other';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'pwa-icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flowstack - Project Management Platform',
        short_name: 'Flowstack',
        description: 'Flowstack - Project Management and Quotation Platform',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      manifestFilename: 'manifest.webmanifest',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tiptap/react/menus": path.resolve(__dirname, "node_modules/@tiptap/react/dist/menus/index.js"),
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'date-fns', 'recharts', '@tiptap/react', '@tiptap/react > @tiptap/react/menus'],
  },
  }; // end return
}); // end defineConfig
