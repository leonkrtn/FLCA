import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const require = createRequire(import.meta.url);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react's `version: "detect"` crashes on ESLint 10
  // (context.getFilename was removed), so pass the installed version directly.
  {
    settings: {
      react: { version: require("react/package.json").version },
    },
  },
  // Server Actions für useActionState bekommen den vorigen Zustand als ersten Parameter, auch wenn sie ihn nicht brauchen.
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
