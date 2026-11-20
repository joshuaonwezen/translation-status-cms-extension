import {logger} from '@zaiusinc/app-sdk';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {type CmsItem, type CmsVersion, VERSION_PAGE_SIZE} from './cms';
import type {TypeInfo} from './fields';
import {baseVersions, type CmsReader, stateOf, summarize, translationStatus, type Unpublished} from './translations';

const v = (version: string, status: string): CmsVersion => ({key: 'k', version, locale: 'nl', status});

describe('stateOf', () => {
  it('reads the newest-first version list', () => {
    expect(stateOf([])).toBe('missing');
    expect(stateOf([v('2', 'draft')])).toBe('draft');
    expect(stateOf([v('3', 'published'), v('2', 'previous')])).toBe('published');
    expect(stateOf([v('4', 'draft'), v('3', 'published')])).toBe('changes');
  });
});

const KEY = '0f8e2d6c4b1a49e7a3c5d7f9b2e4c6a8';
const TYPES: Record<string, TypeInfo> = {
  Page: {properties: {title: {type: 'string', displayName: 'Title', isLocalized: true}}},
};

function version(locale: string, n: number, status: string, title: string, extra: Partial<CmsVersion> = {}): CmsVersion {
  return {
    key: KEY,
    version: String(n),
    locale,
    status,
    contentType: 'Page',
    displayName: 'Home',
    lastModified: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
    properties: {title: {value: title}},
    ...extra,
  };
}

/** Versions newest..oldest, newest first, like the CMS lists them. */
function history(locale: string, newest: number, oldest: number, make: (n: number) => CmsVersion): CmsVersion[] {
  return Array.from({length: newest - oldest + 1}, (_, i) => make(newest - i)).map((x) => ({...x, locale}));
}

/** A CMS client over in-memory versions that records which pages were read. */
function fakeCms(item: CmsItem, byLocale: Record<string, CmsVersion[]>) {
  const pagesRead: string[] = [];
  const cms: CmsReader = {
    getItem: async () => item,
    versionPage: async (_key, locale, pageIndex) => {
      pagesRead.push(`${locale}:${pageIndex}`);
      return (byLocale[locale] ?? []).slice(pageIndex * VERSION_PAGE_SIZE, (pageIndex + 1) * VERSION_PAGE_SIZE);
    },
    getContentType: async (k) => TYPES[k] ?? null,
  };
  return {cms, pagesRead};
}

describe('translationStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  // en: 140 drafts on top of the published version 160, and a published variation on the
  // first page that must not end the scan. nl: 110 drafts on top of its published 890.
  const en = history('en', 300, 51, (n) =>
    n === 250
      ? version('en', n, 'published', 'Variation title', {variation: 'wx_test'})
      : version('en', n, n > 160 ? 'draft' : n === 160 ? 'published' : 'previous', n === 160 ? 'Hello world' : 'Draft title'),
  );
  const nl = history('nl', 1000, 881, (n) =>
    version('nl', n, n > 890 ? 'draft' : n === 890 ? 'published' : 'previous', n === 1000 ? 'Hello world' : 'Hallo wereld'),
  );
  const item: CmsItem = {key: KEY, contentType: 'Page', primaryLocale: 'en', locales: ['en', 'nl']};

  it('pages past the first 100 versions to find the published one, and stops there', async () => {
    const {cms, pagesRead} = fakeCms(item, {en, nl});
    const site = [
      {code: 'en', name: 'English'},
      {code: 'nl', name: 'Nederlands'},
      {code: 'de', name: 'Deutsch'},
    ];
    const outcome = await translationStatus({cms, siteLanguages: async () => site}, KEY);
    if (outcome.kind !== 'status') throw new Error('expected a status');
    const {status} = outcome;

    // The published en version is on the second page; the third is never read.
    expect(pagesRead.filter((p) => p.startsWith('en:'))).toEqual(['en:0', 'en:1']);
    expect(status.source).toEqual({locale: 'en', name: 'English', compared: 'published', lastModified: en.find((x) => x.version === '160')!.lastModified, empty: []});
    expect(status.languages).toBe('site');

    const [nlRow, deRow] = status.locales;
    // Published long ago with newer drafts: not "draft only".
    expect(nlRow).toMatchObject({locale: 'nl', name: 'Nederlands', state: 'changes', translated: 0, total: 1});
    // Compared with the published "Hello world", not the newest en draft.
    expect(nlRow.same).toEqual([{label: 'Title', where: ''}]);
    expect(deRow).toMatchObject({locale: 'de', state: 'missing', total: 1});
  });

  it('reports a failed language lookup instead of hiding the untranslated languages', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const {cms} = fakeCms(item, {en, nl});
    const outcome = await translationStatus({cms, siteLanguages: () => Promise.reject(new Error('CMS down'))}, KEY);
    if (outcome.kind !== 'status') throw new Error('expected a status');
    expect(outcome.status.languages).toBe('item');
    expect(outcome.status.locales.map((r) => [r.locale, r.name])).toEqual([['nl', 'Dutch']]);
  });

  it('lists the source fields that changed since a translation was made', async () => {
    // en published "Hello world" (v10), the nl translation (v11), then en republished as "Hello there" (v12).
    const en2 = [version('en', 12, 'published', 'Hello there'), version('en', 10, 'previous', 'Hello world')];
    const nl2 = [version('nl', 11, 'published', 'Hallo wereld')];
    const {cms} = fakeCms(item, {en: en2, nl: nl2});
    const outcome = await translationStatus({cms, siteLanguages: null}, KEY);
    if (outcome.kind !== 'status') throw new Error('expected a status');
    expect(outcome.status.locales[0]).toMatchObject({olderThanSource: true, changed: [{label: 'Title', where: ''}], translated: 0, total: 1});
  });

  it('answers not_found for a deleted item', async () => {
    const {cms} = fakeCms(item, {});
    cms.getItem = async () => null;
    await expect(translationStatus({cms, siteLanguages: null}, KEY)).rejects.toMatchObject({code: 'not_found'});
  });
});

describe('baseVersions', () => {
  it('reads at most 10 pages when a language was never published', async () => {
    const drafts = history('fr', 1500, 1, (n) => version('fr', n, 'draft', 'Brouillon'));
    const {cms, pagesRead} = fakeCms({key: KEY, locales: ['fr']}, {fr: drafts});
    const versions = await baseVersions(cms, KEY, 'fr');
    expect(pagesRead).toHaveLength(10);
    expect(versions).toHaveLength(1000);
    expect(stateOf(versions)).toBe('draft');
  });
});

describe('summarize', () => {
  const page = (key: string, locale: string, lastModified: string) => ({key, locale, displayName: key, lastModified, url: `/${locale}/${key}/`});
  const languages = [
    {code: 'en', name: 'English'},
    {code: 'nl', name: 'Nederlands'},
    {code: 'de', name: 'Deutsch'},
  ];
  const drafts = new Map<string, Map<string, Unpublished>>([
    ['nl', new Map([['a', {status: 'draft', lastModified: '2026-10-09T00:00:00Z'}]])],
    ['de', new Map([['c', {status: 'inReview', lastModified: '2026-10-03T00:00:00Z'}]])],
  ]);
  const coverage = summarize(
    [
      page('a', 'en', '2026-10-01T00:00:00Z'),
      page('a', 'nl', '2026-10-02T00:00:00Z'),
      page('b', 'en', '2026-10-05T00:00:00Z'),
      page('b', 'nl', '2026-10-01T00:00:00Z'),
      page('c', 'en', '2026-10-01T00:00:00Z'),
    ],
    languages,
    drafts,
  );

  it('takes the most published language as the source and counts the others against it', () => {
    expect(coverage.source).toBe('en');
    expect(coverage.languages).toEqual(languages);
    expect(coverage.pages).toBe(3);
    expect(coverage.totals).toEqual({
      en: {published: 3, stale: 0, draft: 0, missing: 0},
      nl: {published: 1, stale: 1, draft: 0, missing: 1},
      de: {published: 0, stale: 0, draft: 1, missing: 2},
    });
    expect(coverage.truncated).toBe(false);
  });

  it('shows drafts as drafts, and a newer draft on a published page as pending', () => {
    const byKey = Object.fromEntries(coverage.rows.map((r) => [r.key, r]));
    expect(byKey.c.locales.de).toEqual({state: 'draft', lastModified: '2026-10-03T00:00:00Z', pending: false});
    expect(byKey.a.locales.nl).toMatchObject({state: 'published', pending: true});
    expect(byKey.b.locales.nl).toMatchObject({state: 'stale', pending: false});
  });

  it('counts a draft-only language as missing without the CMS', () => {
    const graphOnly = summarize([page('c', 'en', '2026-10-01T00:00:00Z')], languages, null);
    expect(graphOnly.rows[0].locales.de.state).toBe('missing');
  });

  it('lists the most actionable pages first: out of date, then drafts, then not started', () => {
    expect(coverage.rows.map((r) => r.key)).toEqual(['b', 'c', 'a']);
  });
});
