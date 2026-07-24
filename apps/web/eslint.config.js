import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "eslint.config.js", "src/shared/api/generated"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { "prefer": "type-imports" }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["@/features/*/index", "@/shared/*/index"],
              "message": "Use direct file imports; barrel files are prohibited."
            }
          ]
        }
      ],
      "react-refresh/only-export-components": [
        "warn",
        { "allowConstantExport": true }
      ]
    }
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/unbound-method": "off"
    }
  }
);
