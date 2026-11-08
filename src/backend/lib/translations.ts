import type {Coverage, CoverageRow, FieldRef, LocaleRow, LocaleState, StatusOutcome} from '../../shared/types';
import {CmsClient, type CmsVersion} from './cms';
import {compareFields, contentTypesIn, localizedFields, type LocalizedField, type TypeInfo} from './fields';
import {instanceLocales, publishedPages, type PublishedPage} from './graph';
import type {LoadedSettings} from './settings';

export class ActionError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
  }
}

const CONCURRENCY = 6;
const KEY = /^[0-9a-f]{32}$/i;

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

/** Published, published with newer unpublished work, draft only, or no version at all. */
export function stateOf(versions: CmsVersion[]): LocaleState {
  const newest = versions[0];
  if (!newest) return 'missing';
  const published = versions.find((v) => v.status === 'published');
  if (!published) return 'draft';
  return newest === published || newest.status === 'previous' ? 'published' : 'changes';
}

export function createTranslations(cfg: LoadedSettings) {
  const cms = new CmsClient(cfg.cms);
  const types = new Map<string, TypeInfo | null>();
  const loadTypes = async (keys: Iterable<string | undefined>) => {
    const missing = [...new Set(keys)].filter((k): k is string => Boolean(k) && !types.has(k!));
    await mapLimit(missing, CONCURRENCY, async (k) => types.set(k, await cms.getContentType(k)));
  };
  const lookup = (k: string | undefined) => (k ? types.get(k) ?? undefined : undefined);

  return {
    async translationStatus({key}: {key: string; locale: string}): Promise<StatusOutcome> {
      if (!KEY.test(key)) throw new ActionError('invalid_key', 'That is not a content key.');
      const item = await cms.getItem(key);
      if (!item) throw new ActionError('not_found', "The CMS has no item with this key - it may have just been deleted.");
      const itemLocales = (item.locales ?? []).filter(Boolean);
      if (itemLocales.length === 0) return {kind: 'nothing', reason: 'Images, media and folders have no language versions.'};

      const source = item.primaryLocale || itemLocales[0];
      const instance = await instanceLocales(cfg.graph).catch(() => itemLocales);
      const locales = [...new Set([source, ...instance, ...itemLocales])];

      // Base versions only: the CMS API returns a variation's blocks without their values.
      const versions = new Map<string, CmsVersion[]>(
        await mapLimit(locales, CONCURRENCY, async (loc) => {
          const list = itemLocales.includes(loc) ? await cms.listVersions(key, loc, 10) : [];
          return [loc, list.filter((v) => !v.variation).sort(newestFirst)] as [string, CmsVersion[]];
        }),
      );
      await loadTypes([item.contentType, ...[...versions.values()].flat().flatMap((v) => [v.contentType, ...contentTypesIn(v)])]);

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
            return {locale: loc, state, version: null, lastModified: null, olderThanSource: false, empty: [], same: [], translated: 0, total};
          }
          const cmp = compareFields(sourceFields, localizedFields(newest, lookup));
          return {
            locale: loc,
            state,
            version: newest.version,
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
            version: sourceVersion?.version ?? null,
            lastModified: sourceVersion?.lastModified ?? null,
            fields: sourceFields.length,
            empty: sourceFields.filter((f) => !f.text).map(ref),
          },
          locales: rows,
        },
      };
    },

    async coverage(): Promise<Coverage> {
      const [pages, instance] = await Promise.all([publishedPages(cfg.graph), instanceLocales(cfg.graph)]);
      return summarize(pages, instance);
    },
  };
}

/** Published coverage per language from Graph's published pages. Pure, so it is unit-tested. */
export function summarize(pages: PublishedPage[], instance: string[], now = new Date()): Coverage {
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
  return {locales, source, pages: rows.length, totals, rows, checkedAt: now.toISOString()};
}
