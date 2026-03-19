import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          const packagePath = id.split("node_modules/")[1];
          if (!packagePath) {
            return undefined;
          }

          const packageParts = packagePath.split("/");
          const packageName = packageParts[0].startsWith("@")
            ? `${packageParts[0]}/${packageParts[1]}`
            : packageParts[0];

          if (
            packageName === "react" ||
            packageName === "react-dom" ||
            packageName === "react-router" ||
            packageName === "react-router-dom" ||
            packageName === "@remix-run/router" ||
            packageName === "scheduler"
          ) {
            return "react-vendor";
          }

          if (packageName === "@supabase/supabase-js") {
            return "supabase-vendor";
          }

          if (packageName === "@tanstack/react-query") {
            return "query-vendor";
          }

          if (
            packageName.startsWith("@radix-ui/") ||
            packageName === "cmdk" ||
            packageName === "vaul" ||
            packageName === "sonner" ||
            packageName === "next-themes" ||
            packageName === "embla-carousel-react" ||
            packageName === "react-resizable-panels" ||
            packageName === "input-otp"
          ) {
            return "ui-vendor";
          }

          if (packageName === "framer-motion" || packageName === "lucide-react") {
            return "motion-icons";
          }

          if (packageName === "recharts") {
            return "charts-vendor";
          }

          if (
            packageName === "jspdf" ||
            packageName === "jspdf-autotable"
          ) {
            return "pdf-vendor";
          }

          if (packageName === "html2canvas" || packageName === "dompurify") {
            return "html-export-vendor";
          }

          if (packageName === "date-fns") {
            return "date-vendor";
          }

          if (
            packageName === "react-hook-form" ||
            packageName === "@hookform/resolvers" ||
            packageName === "zod"
          ) {
            return "form-vendor";
          }

          if (packageName === "@sentry/react") {
            return "monitoring-vendor";
          }

          if (
            packageName === "clsx" ||
            packageName === "class-variance-authority" ||
            packageName === "tailwind-merge"
          ) {
            return "utility-vendor";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "robots.txt", "offline.html"],
      manifest: {
        id: "/",
        name: "CoParrent - Co-Parenting Custody Toolkit",
        short_name: "CoParrent",
        description: "Smart scheduling, secure messaging, and court-ready documentation for co-parents.",
        theme_color: "#1a2744",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        categories: ["lifestyle", "family", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/og-image.png",
            sizes: "1200x630",
            type: "image/png",
            form_factor: "wide",
            label: "CoParrent Dashboard",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Offline fallback
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
        runtimeCaching: [
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          // Google Fonts webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Static assets from CDNs
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase API - Network first with offline fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
