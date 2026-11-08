import {describe, expect, it} from 'vitest';

import type {CmsVersion} from './cms';
import {stateOf, summarize} from './translations';

const v = (version: string, status: string): CmsVersion => ({key: 'k', version, locale: 'nl', status});

describe('stateOf', () => {
  it('reads the newest-first version list', () => {
    expect(stateOf([])).toBe('missing');
    expect(stateOf([v('2', 'draft')])).toBe('draft');
    expect(stateOf([v('3', 'published'), v('2', 'previous')])).toBe('published');
    expect(stateOf([v('4', 'draft'), v('3', 'published')])).toBe('changes');
  });
});

describe('summarize', () => {
  const page = (key: string, locale: string, lastModified: string) => ({key, locale, displayName: key, lastModified, url: `/${locale}/${key}/`});
  const coverage = summarize(
    [
      page('a', 'en', '2026-10-01T00:00:00Z'),
      page('a', 'nl', '2026-10-02T00:00:00Z'),
      page('b', 'en', '2026-10-05T00:00:00Z'),
      page('b', 'nl', '2026-10-01T00:00:00Z'),
      page('c', 'en', '2026-10-01T00:00:00Z'),
    ],
    ['en', 'nl', 'de'],
  );

  it('takes the most published language as the source and counts the others against it', () => {
    expect(coverage.source).toBe('en');
    expect(coverage.locales).toEqual(['en', 'nl', 'de']);
    expect(coverage.pages).toBe(3);
    expect(coverage.totals).toEqual({en: {published: 3, stale: 0}, nl: {published: 2, stale: 1}, de: {published: 0, stale: 0}});
  });

  it('lists pages with the most gaps first', () => {
    expect(coverage.rows.map((r) => r.key)).toEqual(['c', 'b', 'a']);
    expect(coverage.rows[1].locales.nl.state).toBe('stale');
  });
});
