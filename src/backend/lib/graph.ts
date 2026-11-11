import {MAX_PUBLISHED_ENTRIES} from '../../shared/constants';
import {ApiError, requestJson} from './http';

const GRAPH = 'https://cg.optimizely.com/content/v2';
const PAGE_LIMIT = 100;
const MAX_PAGES = MAX_PUBLISHED_ENTRIES / PAGE_LIMIT;

export interface GraphConfig {
  singleKey: string;
}

export async function graphQuery<T>(cfg: GraphConfig, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = await requestJson<{data?: T; errors?: Array<{message?: string}>}>(
    'graph',
    'Graph query',
    `${GRAPH}?auth=${encodeURIComponent(cfg.singleKey)}`,
    {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query, variables})},
  );
  if (body?.errors?.length) {
    throw new ApiError(400, 'graph_rejected', `Graph query: ${body.errors.map((e) => e.message).join('; ').slice(0, 300)}`);
  }
  if (!body?.data) throw new ApiError(502, 'graph_unavailable', 'Graph query: no data in the response');
  return body.data;
}

/**
 * The instance's languages, from Graph's Locales enum - the same source as the site's
 * getSupportedLocales(). The enum spells region locales with an underscore (ja_JP); the CMS
 * REST API and _metadata.locale use a hyphen (ja-JP).
 */
export async function instanceLocales(cfg: GraphConfig): Promise<string[]> {
  const data = await graphQuery<{__type?: {enumValues?: Array<{name: string}>}}>(cfg, '{ __type(name: "Locales") { enumValues { name } } }');
  return (data.__type?.enumValues ?? [])
    .map((v) => v.name)
    .filter((n) => n !== 'ALL' && n !== 'NEUTRAL')
    .map((n) => n.replace(/_/g, '-'));
}

const PAGES = /* GraphQL */ `
  query Pages($cursor: String) {
    _Content(locale: [ALL], where: {_metadata: {types: {in: ["_Page", "_Experience"]}}}, limit: ${PAGE_LIMIT}, cursor: $cursor) {
      cursor
      items {
        _metadata {
          key
          locale
          displayName
          lastModified
          url {
            default
          }
        }
      }
    }
  }
`;

export interface PublishedPage {
  key: string;
  locale: string;
  displayName: string;
  lastModified: string | null;
  url: string | null;
}

/**
 * Every published page in every language: one entry per page and language, up to
 * MAX_PUBLISHED_ENTRIES. `truncated`: the cap was reached before Graph ran out.
 */
export async function publishedPages(cfg: GraphConfig): Promise<{pages: PublishedPage[]; truncated: boolean}> {
  const pages: PublishedPage[] = [];
  let cursor: string | null = '';
  for (let page = 0; page < MAX_PAGES && cursor !== null; page++) {
    const data: {
      _Content?: {
        cursor?: string | null;
        items?: Array<{_metadata?: {key?: string; locale?: string; displayName?: string; lastModified?: string; url?: {default?: string | null}}}>;
      };
    } = await graphQuery(cfg, PAGES, {cursor: cursor || null});
    const items = data._Content?.items ?? [];
    for (const {_metadata: m} of items) {
      if (!m?.key || !m.locale) continue;
      pages.push({key: m.key, locale: m.locale, displayName: m.displayName ?? m.key, lastModified: m.lastModified ?? null, url: m.url?.default ?? null});
    }
    cursor = items.length === PAGE_LIMIT ? data._Content?.cursor ?? null : null;
  }
  return {pages, truncated: Boolean(cursor)};
}

/** Throws ApiError when the key is rejected. */
export async function checkKey(cfg: GraphConfig): Promise<void> {
  await graphQuery(cfg, '{ _Content(limit: 1) { total } }');
}
