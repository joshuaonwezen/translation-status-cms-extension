import {logger} from '@zaiusinc/app-sdk';

import type {
  Coverage,
  CoverageCell,
  CoverageRow,
  CoverageTotals,
  DraftSource,
  FieldRef,
  Language,
  LanguageSource,
  LocaleRow,
  LocaleState,
  StatusOutcome,
} from '../../shared/types';
import {type CmsClient, type CmsVersion, VERSION_PAGE_SIZE} from './cms';
import {ActionError} from './errors';
import {changedFields, compareFields, contentTypesIn, localizedFields, type LocalizedField, type TypeLookup} from './fields';
import {type GraphConfig, publishedPages, type PublishedPage} from './graph';
import {englishName, languageOf} from './languages';

const CONCURRENCY = 6;
// A language reworked for months can have hundreds of drafts on top of its published
// version; cap the scan rather than let one call eat the function's time budget.
const MAX_VERSION_PAGES = 10;
// Site-wide unpublished versions per language, for the view: 2,000 is far past any
// real backlog of drafts.
const MAX_UNPUBLISHED_PAGES = 20;
/** Versions that aren't live yet but are on their way: what the view calls a draft. */
const UNPUBLISHED = ['draft', 'ready', 'inReview', 'scheduled'];

/** The CMS reads the sidebar needs: a CmsClient, or a fake one in tests. */
export type CmsReader = Pick<CmsClient, 'getItem' | 'versionPage' | 'getContentType'>;

export interface StatusDeps {
  cms: CmsReader;
  /** The site's languages; null when they can't be asked for. */
  siteLanguages: (() => Promise<Language[]>) | null;
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

/** The version the others are compared with: the published one, else the newest draft. */
const sourceVersionOf = (versions: CmsVersion[]): CmsVersion | null =>
  versions.find((v) => v.status === 'published') ?? versions[0] ?? null;

/**
 * The source version a translation was most likely made from: the newest one that was
 * published (now or before) when the translation was last changed.
 */
function basedOn(sourceVersions: CmsVersion[], translation: CmsVersion): CmsVersion | null {
  const at = time(translation.lastModified);
  return sourceVersions.find((v) => (v.status === 'published' || v.status === 'previous') && time(v.lastModified) <= at) ?? null;
}

/** The site's languages, or only the item's own when they can't be read. */
async function languagesFor(deps: StatusDeps, itemLocales: string[]): Promise<{languages: Language[]; from: LanguageSource}> {
  const own = () => itemLocales.map((code) => ({code, name: englishName(code)}));
  if (!deps.siteLanguages) return {languages: own(), from: 'item'};
  try {
    return {languages: await deps.siteLanguages(), from: 'site'};
  } catch (error) {
    logger.warn('Could not read the site languages', error);
    return {languages: own(), from: 'item'};
  }
}

async function contentTypes(cms: CmsReader, keys: Iterable<string | undefined>): Promise<TypeLookup> {
  const unique = [...new Set(keys)].filter((k): k is string => Boolean(k));
  const found = new Map(await mapLimit(unique, CONCURRENCY, async (k) => [k, await cms.getContentType(k)] as const));
  return (k) => (k ? found.get(k) ?? undefined : undefined);
}

/** Every content type the item's versions use, page and inline blocks alike. */
function typesUsed(contentType: string | undefined, versions: CmsVersion[]): Array<string | undefined> {
  return [contentType, ...versions.flatMap((v) => [v.contentType, ...contentTypesIn(v)])];
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
  // The site's order, then any language the item is in that the site no longer lists.
  const locales = [...new Set([source, ...site.languages.map((l) => l.code), ...itemLocales])];
  const named = (code: string) => languageOf(code, site.languages).name;

  const versions = new Map<string, CmsVersion[]>(
    await mapLimit(locales, CONCURRENCY, async (loc) => {
      const list = itemLocales.includes(loc) ? await baseVersions(cms, key, loc) : [];
      return [loc, list] as [string, CmsVersion[]];
    }),
  );
  const lookup = await contentTypes(cms, typesUsed(item.contentType, [...versions.values()].flat()));

  const sourceVersions = versions.get(source) ?? [];
  const sourceVersion = sourceVersionOf(sourceVersions);
  const sourceFields = sourceVersion ? localizedFields(sourceVersion, lookup) : [];
  const total = sourceFields.filter((f) => f.text).length;

  const rows: LocaleRow[] = locales
    .filter((loc) => loc !== source)
    .map((loc) => {
      const list = versions.get(loc) ?? [];
      const newest = list[0] ?? null;
      const base = {locale: loc, name: named(loc), state: stateOf(list)};
      if (!newest) return {...base, lastModified: null, olderThanSource: false, empty: [], same: [], changed: [], translated: 0, total};

      const cmp = compareFields(sourceFields, localizedFields(newest, lookup));
      const olderThanSource = time(sourceVersion?.lastModified) > time(newest.lastModified);
      // Which source fields changed since: compare the current source with the one the
      // translation was made from. Fields already empty or untranslated are listed there.
      let changed: LocalizedField[] = [];
      const earlier = olderThanSource ? basedOn(sourceVersions, newest) : null;
      if (earlier && earlier !== sourceVersion) {
        const open = new Set([...cmp.empty, ...cmp.same].map((f) => f.id));
        changed = changedFields(sourceFields, localizedFields(earlier, lookup)).filter((f) => !open.has(f.id));
      }
      return {
        ...base,
        lastModified: newest.lastModified ?? null,
        olderThanSource,
        empty: cmp.empty.map(ref),
        same: cmp.same.map(ref),
        changed: changed.map(ref),
        translated: cmp.translated - changed.length,
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
        name: named(source),
        compared: !sourceVersion ? null : sourceVersion.status === 'published' ? 'published' : 'draft',
        lastModified: sourceVersion?.lastModified ?? null,
        empty: sourceFields.filter((f) => !f.text).map(ref),
      },
      locales: rows,
      languages: site.from,
    },
  };
}

/** An item's newest unpublished version in one language. */
export interface Unpublished {
  status: string;
  lastModified: string | null;
}

/** Every item's newest unpublished base version in `locale`, site-wide, by key. */
export async function unpublishedIn(cms: Pick<CmsClient, 'queryVersions'>, locale: string): Promise<Map<string, Unpublished>> {
  const found = new Map<string, Unpublished>();
  for (let pageIndex = 0; pageIndex < MAX_UNPUBLISHED_PAGES; pageIndex++) {
    const items = await cms.queryVersions(locale, UNPUBLISHED, pageIndex);
    for (const v of items) {
      if (v.variation) continue;
      const key = v.key.replace(/-/g, '').toLowerCase();
      const seen = found.get(key);
      if (!seen || time(v.lastModified) > time(seen.lastModified)) found.set(key, {status: v.status, lastModified: v.lastModified ?? null});
    }
    if (items.length < VERSION_PAGE_SIZE) break;
  }
  return found;
}

export interface CoverageDeps {
  graph: GraphConfig;
  /** Reads drafts site-wide; null without a CMS client. */
  cms: Pick<CmsClient, 'queryVersions'> | null;
  languages: () => Promise<Language[]>;
}

/** Published pages per language from Graph, and their drafts from the CMS when it can. */
export async function coverage(deps: CoverageDeps): Promise<Coverage> {
  const [{pages, truncated}, languages] = await Promise.all([publishedPages(deps.graph), deps.languages()]);
  const source = sourceOf(pages, languages);

  let unpublished: Map<string, Map<string, Unpublished>> | null = null;
  let drafts: DraftSource = 'no_cms';
  const {cms} = deps;
  if (cms) {
    try {
      const others = languages.map((l) => l.code).filter((l) => l !== source);
      unpublished = new Map(await mapLimit(others, CONCURRENCY, async (l) => [l, await unpublishedIn(cms, l)] as const));
      drafts = 'cms';
    } catch (error) {
      logger.warn('Could not read unpublished versions from the CMS', error);
      drafts = 'failed';
    }
  }
  return {...summarize(pages, languages, unpublished, truncated), drafts};
}

/** The language most pages are published in: the one the others translate from. */
export function sourceOf(pages: PublishedPage[], languages: Language[]): string {
  const counts = new Map<string, number>();
  for (const p of pages) counts.set(p.locale, (counts.get(p.locale) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? languages[0]?.code ?? 'en';
}

// Most actionable first: pages to update, then drafts to review, then pages not started.
const WEIGHT: Record<CoverageCell['state'], number> = {stale: 4, draft: 3, missing: 1, published: 0};

/** Coverage per language. Pure, so it is unit-tested. */
export function summarize(
  pages: PublishedPage[],
  languages: Language[],
  unpublished: Map<string, Map<string, Unpublished>> | null,
  truncated = false,
): Omit<Coverage, 'drafts'> {
  const byKey = new Map<string, Map<string, PublishedPage>>();
  for (const p of pages) {
    if (!byKey.has(p.key)) byKey.set(p.key, new Map());
    byKey.get(p.key)!.set(p.locale, p);
  }
  const source = sourceOf(pages, languages);
  const codes = [source, ...[...new Set([...languages.map((l) => l.code), ...pages.map((p) => p.locale)])].filter((l) => l !== source)];
  const named = codes.map((code) => languageOf(code, languages));
  const totals: Record<string, CoverageTotals> = Object.fromEntries(codes.map((l) => [l, {published: 0, stale: 0, draft: 0, missing: 0}]));

  const rows: CoverageRow[] = [...byKey].map(([key, versions]) => {
    const src = versions.get(source) ?? [...versions.values()][0];
    const row: CoverageRow = {key, displayName: src.displayName, url: src.url, sourceModified: src.lastModified, locales: {}};
    for (const loc of codes) {
      const live = versions.get(loc);
      const waiting = unpublished?.get(loc)?.get(key.replace(/-/g, '').toLowerCase());
      let cell: CoverageCell;
      if (live) {
        const stale = loc !== source && time(live.lastModified) < time(src.lastModified);
        cell = {state: stale ? 'stale' : 'published', lastModified: live.lastModified, pending: Boolean(waiting && time(waiting.lastModified) > time(live.lastModified))};
      } else if (waiting) {
        cell = {state: 'draft', lastModified: waiting.lastModified, pending: false};
      } else {
        cell = {state: 'missing', lastModified: null, pending: false};
      }
      row.locales[loc] = cell;
      totals[loc][cell.state]++;
    }
    return row;
  });

  const weight = (r: CoverageRow) => Object.values(r.locales).reduce((n, l) => n + WEIGHT[l.state], 0);
  rows.sort((a, b) => weight(b) - weight(a) || a.displayName.localeCompare(b.displayName));
  return {languages: named, source, pages: rows.length, totals, rows, truncated};
}
