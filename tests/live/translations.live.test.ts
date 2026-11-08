import {writeFileSync} from 'node:fs';

import {describe, expect, it} from 'vitest';

import {createTranslations} from '../../src/backend/lib/translations';

// Read-only: reads one item's language versions and the published pages per language.
// TRANSLATIONS_LIVE=1 OPTIMIZELY_CMS_CLIENT_ID=… OPTIMIZELY_CMS_CLIENT_SECRET=… OPTIMIZELY_GRAPH_SINGLE_KEY=… \
// TRANSLATIONS_LIVE_KEY=<content key> TRANSLATIONS_LIVE_OUT=/tmp/translations.json yarn vitest run tests/live
const live = process.env.TRANSLATIONS_LIVE === '1';

describe.skipIf(!live)('translation status against a real CMS', () => {
  const translations = createTranslations({
    graph: {singleKey: process.env.OPTIMIZELY_GRAPH_SINGLE_KEY ?? ''},
    cms: {clientId: process.env.OPTIMIZELY_CMS_CLIENT_ID ?? '', clientSecret: process.env.OPTIMIZELY_CMS_CLIENT_SECRET ?? ''},
  });

  it('compares an item and counts coverage', async () => {
    const status = await translations.translationStatus({key: process.env.TRANSLATIONS_LIVE_KEY ?? '', locale: 'en'});
    const coverage = await translations.coverage();
    if (process.env.TRANSLATIONS_LIVE_OUT) writeFileSync(process.env.TRANSLATIONS_LIVE_OUT, JSON.stringify({status, coverage}, null, 2));
    expect(status.kind).toBe('status');
    expect(coverage.pages).toBeGreaterThan(0);
  });
});
