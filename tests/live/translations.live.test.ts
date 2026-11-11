import {writeFileSync} from 'node:fs';

import {describe, expect, it} from 'vitest';

import {CmsClient} from '../../src/backend/lib/cms';
import {instanceLocales} from '../../src/backend/lib/graph';
import {coverage, translationStatus} from '../../src/backend/lib/translations';
import {contentKey} from '../../src/backend/lib/validate';

// Read-only: reads one item's language versions and the published pages per language.
// TRANSLATIONS_LIVE=1 OPTIMIZELY_CMS_CLIENT_ID=… OPTIMIZELY_CMS_CLIENT_SECRET=… OPTIMIZELY_GRAPH_SINGLE_KEY=… \
// TRANSLATIONS_LIVE_KEY=<content key> TRANSLATIONS_LIVE_OUT=/tmp/translations.json yarn vitest run tests/live
const live = process.env.TRANSLATIONS_LIVE === '1';

describe.skipIf(!live)('translation status against a real CMS', () => {
  const graph = {singleKey: process.env.OPTIMIZELY_GRAPH_SINGLE_KEY ?? ''};
  const cms = new CmsClient({
    clientId: process.env.OPTIMIZELY_CMS_CLIENT_ID ?? '',
    clientSecret: process.env.OPTIMIZELY_CMS_CLIENT_SECRET ?? '',
  });

  it('compares an item and counts coverage', async () => {
    const key = contentKey(process.env.TRANSLATIONS_LIVE_KEY);
    const status = await translationStatus({cms, siteLocales: () => instanceLocales(graph)}, key);
    const pages = await coverage(graph);
    if (process.env.TRANSLATIONS_LIVE_OUT) writeFileSync(process.env.TRANSLATIONS_LIVE_OUT, JSON.stringify({status, coverage: pages}, null, 2));
    expect(status.kind).toBe('status');
    expect(pages.pages).toBeGreaterThan(0);
  });
});
