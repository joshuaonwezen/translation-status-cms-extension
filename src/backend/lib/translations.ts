import {logger} from '@zaiusinc/app-sdk';

import type {Coverage, CoverageRow, FieldRef, LanguageSource, LocaleRow, LocaleState, StatusOutcome} from '../../shared/types';
import {type CmsClient, type CmsVersion, VERSION_PAGE_SIZE} from './cms';
import {ActionError} from './errors';
import {compareFields, contentTypesIn, localizedFields, type LocalizedField, type TypeLookup} from './fields';
import {type GraphConfig, instanceLocales, publishedPages, type PublishedPage} from './graph';

const CONCURRENCY = 6;
// A language reworked for months can have hundreds of drafts on top of its published
// version; cap the scan rather than let one call eat the function's time budget.
const MAX_VERSION_PAGES = 10;

/** The CMS reads the sidebar needs: a CmsClient, or a fake one in tests. */
export type CmsReader = Pick<CmsClient, 'getItem' | 'versionPage' | 'getContentType'>;

export interface StatusDeps {
  cms: CmsReader;
  /** The site's languages (Graph's Locales enum); null when the app has no Graph key. */
  siteLocales: (() => Promise<string[]>) | null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return results;
}

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const ref = (f: LocalizedField): FieldRef => ({label: f.label, where: f.where});
const newestFirst = (a: CmsVersion, b: CmsVersion) => Number(b.version) - Number(a.version);
const isPublishedBase = (v: CmsVersion) => !v.variation && v.status === 'published';

/** Published, published with newer unpublished work, draft only, or no version at all. */
export function stateOf(versions: CmsVersion[]): LocaleState {
  const newest = versions[0];
  if (!newest) return 'missing';
  const published = versions.find((v) => v.status === 'published');
  if (!published) return 'draft';
  return newest === published || newest.status === 'previous' ? 'published' : 'changes';
}

/**
 * The item's base versions in `locale`, newest first. Reads a page of 100 at a time until
 * the published one turns up (it sits far down when a language has had many drafts since),
 * for at most 10 pages. Variations are left out: the CMS API returns their blocks without
 * their values.
 */
export async function baseVersions(cms: CmsReader, key: string, locale: string): Promise<CmsVersion[]> {
  const versions: CmsVersion[] = [];
  for (let pageIndex = 0; pageIndex < MAX_VERSION_PAGES; pageIndex++) {
    const items = await cms.versionPage(key, locale, pageIndex);
    versions.push(...items);
    if (items.length < VERSION_PAGE_SIZE || items.some(isPublishedBase)) break;
  }
  return versions.filter((v) => !v.variation).sort(newestFirst);
}

/** The site's languages from Graph, or only the item's own when Graph can't be asked. */
async function languagesFor(deps: StatusDeps, itemLocales: string[]): Promise<{locales: string[]; languages: LanguageSource}> {
  if (!deps.siteLocales) return {locales: itemLocales, languages: 'no_graph_key'};
  try {
    return {locales: await deps.siteLocales(), languages: 'site'};
  } catch (error) {
    logger.warn('Could not read the site languages from Graph', error);
    return {locales: itemLocales, languages: 'graph_failed'};
  }
}

async function contentTypes(cms: CmsReader, keys: Iterable<string | undefined>): Promise<TypeLookup> {
  const unique = [...new Set(keys)].filter((k): k is string => Boolean(k));
  const found = new Map(await mapLimit(unique, CONCURRENCY, async (k) => [k, await cms.getContentType(k)] as const));
  return (k) => (k ? found.get(k) ?? undefined : undefined);
}

/** Each language of the item compared with its source language, field by field. */
export async function translationStatus(deps: StatusDeps, key: string): Promise<StatusOutcome> {
  const {cms} = deps;
  const item = await cms.getItem(key);
  if (!item) throw new ActionError('not_found', "This item can't be found in the CMS. It may have just been deleted.");
  const itemLocales = (item.locales ?? []).filter(Boolean);
  if (itemLocales.length === 0) return {kind: 'nothing', reason: 'Images, media and folders have no language versions.'};

  const source = item.primaryLocale || itemLocales[0];
  const site = await languagesFor(deps, itemLocales);
  const locales = [...new Set([source, ...site.locales, ...itemLocales])];

  const versions = new Map<string, CmsVersion[]>(
    await mapLimit(locales, CONCURRENCY, async (loc) => {
      const list = itemLocales.includes(loc) ? await baseVersions(cms, key, loc) : [];
      return [loc, list] as [string, CmsVersion[]];
    }),
  );
  const lookup = await contentTypes(cms, [
    item.contentType,
    ...[...versions.values()].flat().flatMap((v) => [v.contentType, ...contentTypesIn(v)]),
  ]);

  const sourceVersions = versions.get(source) ?? [];
  const sourceVersion = sourceVersions.find((v) => v.status === 'published') ?? sourceVersions[0] ?? null;
  const sourceFields = sourceVersion ? localizedFields(sourceVersion, lookup) : [];

  const rows: LocaleRow[] = locales
    .filter((loc) => loc !== source)
    .map((loc) => {
      const list = versions.get(loc) ?? [];
      const newest = list[0] ?? null;
      const state = stateOf(list);
      const total = sourceFields.filter((f) => f.text).length;
      if (!newest) {
        return {locale: loc, state, lastModified: null, olderThanSource: false, empty: [], same: [], translated: 0, total};
      }
      const cmp = compareFields(sourceFields, localizedFields(newest, lookup));
      return {
        locale: loc,
        state,
        lastModified: newest.lastModified ?? null,
        olderThanSource: time(sourceVersion?.lastModified) > time(newest.lastModified),
        empty: cmp.empty.map(ref),
        same: cmp.same.map(ref),
        translated: cmp.translated,
        total: cmp.total,
      };
    });

  return {
    kind: 'status',
    status: {
      key,
      displayName: sourceVersion?.displayName || key,
      source: {
        locale: source,
        compared: !sourceVersion ? null : sourceVersion.status === 'published' ? 'published' : 'draft',
        lastModified: sourceVersion?.lastModified ?? null,
        empty: sourceFields.filter((f) => !f.text).map(ref),
      },
      locales: rows,
      languages: site.languages,
    },
  };
}

/** Published pages per language, from Graph only. */
export async function coverage(graph: GraphConfig): Promise<Coverage> {
  const [{pages, truncated}, instance] = await Promise.all([publishedPages(graph), instanceLocales(graph)]);
  return summarize(pages, instance, truncated);
}

/** Published coverage per language from Graph's published pages. Pure, so it is unit-tested. */
export function summarize(pages: PublishedPage[], instance: string[], truncated = false): Coverage {
  const byKey = new Map<string, Map<string, PublishedPage>>();
  const counts = new Map<string, number>();
  for (const p of pages) {
    if (!byKey.has(p.key)) byKey.set(p.key, new Map());
    byKey.get(p.key)!.set(p.locale, p);
    counts.set(p.locale, (counts.get(p.locale) ?? 0) + 1);
  }
  // The language most pages are published in is the one the others translate from.
  const source = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? instance[0] ?? 'en';
  const locales = [source, ...[...new Set([...instance, ...counts.keys()])].filter((l) => l !== source)];
  const totals: Coverage['totals'] = Object.fromEntries(locales.map((l) => [l, {published: 0, stale: 0}]));

  const rows: CoverageRow[] = [...byKey].map(([key, versions]) => {
    const src = versions.get(source) ?? [...versions.values()][0];
    const row: CoverageRow = {key, displayName: src.displayName, url: src.url, sourceModified: src.lastModified, locales: {}};
    for (const loc of locales) {
      const v = versions.get(loc);
      const stale = Boolean(v && loc !== source && time(v.lastModified) < time(src.lastModified));
      row.locales[loc] = {state: !v ? 'missing' : stale ? 'stale' : 'published', lastModified: v?.lastModified ?? null};
      if (v) totals[loc].published++;
      if (stale) totals[loc].stale++;
    }
    return row;
  });

  const weight = (r: CoverageRow) =>
    Object.values(r.locales).reduce((n, l) => n + (l.state === 'missing' ? 2 : l.state === 'stale' ? 1 : 0), 0);
  rows.sort((a, b) => weight(b) - weight(a) || a.displayName.localeCompare(b.displayName));
  return {locales, source, pages: rows.length, totals, rows, truncated};
}
