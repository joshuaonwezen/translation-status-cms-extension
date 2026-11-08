import {logger, storage, ValueHash} from '@zaiusinc/app-sdk';

import type {CmsConfig} from './cms';
import type {GraphConfig} from './graph';

// Section keys match forms/settings.yml.
// Type aliases, not interfaces: the settings store requires an index-signature-compatible shape.
export type GraphSettings = {
  singleKey?: string;
};

export type CmsSettings = {
  clientId?: string;
  clientSecret?: string;
};

export interface LoadedSettings {
  graph: GraphConfig;
  cms: CmsConfig;
}

export type LoadedConfig = {ok: true; config: LoadedSettings} | {ok: false; missing: string[]};

/**
 * One settings section, or {} when the store can't be read. On a CMS-scoped install that has
 * never saved its settings, the production store throws "Failed to get value at
 * app-data/<install>/settings" instead of returning {}.
 */
export async function readSection<T extends ValueHash>(section: string): Promise<T> {
  try {
    return await storage.settings.get<T>(section);
  } catch (error) {
    logger.warn('Could not read settings section', section, error);
    return {} as T;
  }
}

export async function loadConfig(): Promise<LoadedConfig> {
  const [graph, cms] = await Promise.all([readSection<GraphSettings>('graph'), readSection<CmsSettings>('cms')]);
  const singleKey = graph.singleKey?.trim() ?? '';
  const clientId = cms.clientId?.trim() ?? '';
  const clientSecret = cms.clientSecret?.trim() ?? '';

  const missing = [!singleKey && 'Graph single key', !clientId && 'CMS client ID', !clientSecret && 'CMS client secret'].filter(
    (m): m is string => Boolean(m),
  );
  return missing.length > 0 ? {ok: false, missing} : {ok: true, config: {graph: {singleKey}, cms: {clientId, clientSecret}}};
}
