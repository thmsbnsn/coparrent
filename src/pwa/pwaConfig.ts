export const coparrentPwaOptions = {
  registerType: "autoUpdate",
  includeAssets: [
    "favicon.ico",
    "favicon.svg",
    "favicon-32x32.png",
    "favicon-16x16.png",
    "apple-touch-icon.png",
    "robots.txt",
    "offline.html",
  ],
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
    importScripts: ["push-notifications-sw.js"],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "images-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 5,
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
} as const;
