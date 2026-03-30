import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { coparrentPwaOptions } from "./src/pwa/pwaConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    VitePWA(coparrentPwaOptions),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
