// @ts-check
// Mirrors claims-management-main/frontend/eslint.config.js rule-for-rule
// (angular-eslint + typescript-eslint + prettier), minus the @nx/eslint-plugin
// base configs — this isn't an Nx workspace, so there's no Nx project graph
// for those rules to check against.
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    // supabase/functions/* is Deno, not this Angular app — it has its own
    // linter (`// deno-lint-ignore` comments already in use there), and
    // isn't even valid under this tsconfig's compiler options.
    ignores: ['**/dist', '**/coverage', '**/node_modules', 'supabase/**']
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettierConfig
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      // This codebase already used a leading-underscore convention for
      // intentional no-op params (stage/callback hooks that must match a
      // signature but don't need the value) before any lint existed here —
      // respect that convention rather than forcing every call site to be
      // rewritten.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ]
    }
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // label-has-associated-control only recognizes native form elements by
      // default — NDBX form components (nx-checkbox, nx-radio, nx-dropdown)
      // render their real <input>/<select> inside their own template, which
      // this rule can't see through, so a correctly-wrapping <label> around
      // one of these still false-positives without this whitelist.
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        { controlComponents: ['nx-checkbox', 'nx-radio', 'nx-dropdown', 'nx-switcher'] }
      ]
    }
  }
);
