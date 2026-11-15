import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Global ignores ACCUMULATE — this block is ADDED to eslint-config-next's
  // own ignores, it does not replace them (eslint-config-next says as much:
  // you add more, or negate one with a leading `!`). The defaults are
  // restated anyway so the project's whole ignore surface is readable in one
  // place, and so a future `'!.next/…'` negation is written knowing what it
  // negates. Harmless duplication, on purpose — do not read it as "required
  // or eslint crawls .next/".
  globalIgnores([
    // eslint-config-next defaults:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // ours: vitest coverage reports are not source
    'coverage/**',
    'test-results/**',
    // project: reference material and agent tooling, not app source
    '.agents/**',
    'HTML/**',
    'Lubrication Monitoring Platform/**',
  ]),
  {
    // ⚠ deviation (DESIGN.md §10 / docs/project-context): eslint-config-next 16 turns the
    // React Compiler rules on as errors. They flag ~25 spots that predate the upgrade —
    // including registry/kit files (combobox, settings-sheet, use-mobile) — all working
    // code. Warn until each is reworked; new code should not add to the count.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);

export default eslintConfig;
