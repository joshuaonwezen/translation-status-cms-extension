import type {CompositionNode, Properties, TypeInfo} from './fields';
import {ApiError, requestJson} from './http';

const CMS_API = 'https://api.cms.optimizely.com';
export const VERSION_PAGE_SIZE = 100;
const EXPIRY_BUFFER_MS = 30_000;

export interface CmsConfig {
  clientId: string;
  clientSecret: string;
}

export interface CmsVersion {
  key: string;
  version: string;
  locale: string;
  status: string;
  contentType?: string;
  displayName?: string;
  /** Absent on base versions. */
  variation?: string | null;
  lastModified?: string;
  properties?: Properties | null;
  composition?: CompositionNode | null;
}

export interface CmsItem {
  key: string;
  contentType?: string;
  primaryLocale?: string | null;
  /** [''] for items without language versions (media, folders). */
  locales?: string[];
}

// Module scope survives warm invocations of the function.
let tokenCache: {clientId: string; token: string; expiresAt: number} | null = null;

export class CmsClient {
  private readonly cfg: CmsConfig;

  public constructor(cfg: CmsConfig) {
    this.cfg = cfg;
  }

  public async token(): Promise<string> {
    if (tokenCache && tokenCache.clientId === this.cfg.clientId && tokenCache.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
      return tokenCache.token;
    }
    const body = await requestJson<{access_token: string; expires_in: number}>('cms', 'CMS token', `${CMS_API}/oauth/token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
      }),
    });
    if (!body?.access_token) throw new ApiError(502, 'cms_unavailable', 'CMS token: no access_token in response');
    tokenCache = {clientId: this.cfg.clientId, token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000};
    return body.access_token;
  }

  private async get<T>(label: string, path: string): Promise<T | null> {
    return requestJson<T>('cms', label, `${CMS_API}${path}`, {
      headers: {Authorization: `Bearer ${await this.token()}`},
    });
  }

  /** Null when the content doesn't exist (deleted, or never did). */
  public async getItem(key: string): Promise<CmsItem | null> {
    try {
      return await this.get<CmsItem>('Get content', `/v1/content/${key}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * One page of the item's versions in `locale`, newest first, with their content; [] when
   * the item has no version there (or no languages at all: media, folders).
   */
  public async versionPage(key: string, locale: string, pageIndex: number): Promise<CmsVersion[]> {
    try {
      const page = await this.get<{items?: CmsVersion[]}>(
        'List versions',
        `/v1/content/${key}/locales/${encodeURIComponent(locale)}?pageSize=${VERSION_PAGE_SIZE}&pageIndex=${pageIndex}`,
      );
      return page?.items ?? [];
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return [];
      throw error;
    }
  }

  public async getContentType(key: string): Promise<TypeInfo | null> {
    try {
      return await this.get<TypeInfo>('Get content type', `/v1/contenttypes/${encodeURIComponent(key)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
}
