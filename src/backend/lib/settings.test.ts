import {logger, resetLocalSettingsStore, storage} from '@zaiusinc/app-sdk';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {loadConfig, requireCms, requireGraph} from './settings';

describe('settings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetLocalSettingsStore();
  });

  it('treats an unreadable store as empty', async () => {
    // What the production store throws on an install that has never saved its settings.
    vi.spyOn(storage.settings, 'get').mockRejectedValue(new Error('Failed to get value at app-data/1/settings'));
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const config = await loadConfig();
    expect(config).toEqual({cms: null, graph: null});
    expect(() => requireCms(config)).toThrow(/CMS API client/);
    expect(() => requireGraph(config)).toThrow(/Graph key/);
  });

  it('lets the sidebar run on the CMS client alone', async () => {
    await storage.settings.put('cms', {clientId: ' id ', clientSecret: 'secret'});
    const config = await loadConfig();
    expect(config).toEqual({cms: {clientId: 'id', clientSecret: 'secret'}, graph: null});
    expect(requireCms(config)).toEqual({clientId: 'id', clientSecret: 'secret'});
    expect(() => requireGraph(config)).toThrow(/Graph key/);
  });

  it('needs both halves of the CMS client', async () => {
    await storage.settings.put('cms', {clientId: 'id'});
    await storage.settings.put('graph', {singleKey: 'key'});
    expect(await loadConfig()).toEqual({cms: null, graph: {singleKey: 'key'}});
  });
});
