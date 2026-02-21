import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import security from "eslint-plugin-security";
import prettier from "eslint-plugin-prettier";
import pluginSecurity from 'eslint-plugin-security'
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url),
    __dirname = path.dirname(__filename),
    compat = new FlatCompat({
        baseDirectory: __dirname,
        recommendedConfig: js.configs.recommended,
        allConfig: js.configs.all
    });

export default defineConfig([globalIgnores(["dist/*", "lib/*"]), {
    ...pluginSecurity.configs.recommended,
    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ),

    plugins: {
        "@typescript-eslint": typescriptEslint,
        security,
        prettier,
    },

    languageOptions: {
        globals: {
            ...globals.amd,
            ...globals.browser,
            ...globals.worker,
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",
    },

    rules: {
        "no-magic-numbers": "off",
        "id-length": "off",
        "max-classes-per-file": "off",
        "sort-keys": "off",
        "sort-vars": "off",
        "no-bitwise": "off",
        "no-plusplus": "off",
        "no-await-in-loop": "off",
        "capitalized-comments": "off",
        "valid-jsdoc": "off",
        "multiline-comment-style": "off",
        "func-style": ["error", "declaration"],
        "one-var": ["error", "consecutive"],

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],
    },
}]);