import {logger, storage, ValueHash} from '@zaiusinc/app-sdk';

import type {CmsConfig} from './cms';
import {NotConfiguredError} from './errors';
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

/**
 * Each part is null until it is saved. The sidebar needs the CMS client and uses Graph
 * when it can; the view needs Graph only.
 */
export interface LoadedConfig {
  cms: CmsConfig | null;
  graph: GraphConfig | null;
}

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
  return {
    cms: clientId && clientSecret ? {clientId, clientSecret} : null,
    graph: singleKey ? {singleKey} : null,
  };
}

export function requireCms(config: LoadedConfig): CmsConfig {
  if (!config.cms) throw new NotConfiguredError('The app settings are missing the CMS API client ID and secret.');
  return config.cms;
}

export function requireGraph(config: LoadedConfig): GraphConfig {
  if (!config.graph) throw new NotConfiguredError('The app settings are missing the Optimizely Graph key.');
  return config.graph;
}
