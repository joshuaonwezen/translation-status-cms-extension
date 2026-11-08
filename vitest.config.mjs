import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {defineConfig} from 'vitest/config';

const cwd = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {'@shared': path.resolve(cwd, 'src/shared')},
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // tests/live/* read the real CMS and Graph; they skip themselves unless TRANSLATIONS_LIVE=1.
    testTimeout: 120_000,
  },
});
