import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  Deno: "readonly",
};

export default [
  {
    ignores: [
      "dist",
      "dev-dist",
      "output",
      "tmp",
      "supabase/.temp",
      ".vercel",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: sharedGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-undef": "off",
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true,
        allowExportNames: [
          "FEATURE_STATUS",
          "withParentOnly",
          "useCookieConsent",
          "useOnboardingComplete",
          "badgeVariants",
          "buttonVariants",
          "useFormField",
          "navigationMenuTriggerStyle",
          "useSidebar",
          "toast",
          "toggleVariants",
          "useAuth",
          "useFamily",
        ],
      }],
    },
  },
];
