const rootDir = process.cwd().replace(/\\/g, "/");

export default {
  test: {
    environment: "jsdom",
    pool: "threads",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "supabase/functions/_shared/**/*.test.ts",
    ],
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: `${rootDir}/src`,
      },
      {
        find: "https://deno.land/std@0.190.0/http/server.ts",
        replacement: `${rootDir}/supabase/functions/_shared/test-shims/denoHttpServer.ts`,
      },
      {
        find: "https://esm.sh/@supabase/supabase-js@2",
        replacement: `${rootDir}/supabase/functions/_shared/test-shims/supabaseEdge.ts`,
      },
      {
        find: "https://esm.sh/@supabase/supabase-js@2.57.2",
        replacement: `${rootDir}/supabase/functions/_shared/test-shims/supabaseEdge.ts`,
      },
      {
        find: "https://deno.land/x/zod@v3.22.4/mod.ts",
        replacement: `${rootDir}/supabase/functions/_shared/test-shims/zodShim.ts`,
      },
    ],
  },
};
