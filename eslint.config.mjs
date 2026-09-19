import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
  ...(Array.isArray(nextTypescript) ? nextTypescript : [nextTypescript]),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'prisma/**',
      'tests/**',
      'scripts/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // These stay as ERRORS — they catch real correctness bugs:
      //   react-hooks/purity, react-hooks/refs, react-hooks/rules-of-hooks,
      //   react-hooks/exhaustive-deps, and all @next correctness rules.
      //
      // The rules below are downgraded to WARN (surfaced, but not build-failing)
      // because they fire on legitimate, intentional patterns rather than bugs:
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // SSR-safe hydration: localStorage/theme/i18n providers MUST read the
      // browser value after mount and setState once. This is the React-endorsed
      // pattern for values unavailable during server render; the effect runs
      // once with an empty dep array and does not cascade.
      'react-hooks/set-state-in-effect': 'warn',
      // Cosmetic: apostrophes/quotes in JSX copy. Not a runtime or a11y issue.
      'react/no-unescaped-entities': 'warn',
    },
  },
]

export default eslintConfig
