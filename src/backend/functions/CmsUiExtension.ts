import * as App from '@zaiusinc/app-sdk';
import {logger} from '@zaiusinc/app-sdk';

import type {ActionName, ActionParams, ActionResults, Envelope} from '../../shared/types';
import {CmsClient} from '../lib/cms';
import {ActionError, NotConfiguredError} from '../lib/errors';
import {instanceLocales} from '../lib/graph';
import {ApiError} from '../lib/http';
import {type LoadedConfig, loadConfig, requireCms, requireGraph} from '../lib/settings';
import {coverage, translationStatus} from '../lib/translations';
import {isAction, PARSERS} from '../lib/validate';

interface RequestBody {
  action?: unknown;
  params?: unknown;
}

function ok<T>(result: T): Envelope<T> {
  return {ok: true, result};
}

function fail(error: string, message?: string): Envelope<never> {
  return message ? {ok: false, error, message} : {ok: false, error};
}

type Handlers = {[A in ActionName]: (config: LoadedConfig, params: ActionParams[A]) => Promise<ActionResults[A]>};

const HANDLERS: Handlers = {
  // The sidebar needs the CMS client; Graph only adds the languages the item isn't in yet.
  translationStatus: (config, p) => {
    const {graph} = config;
    return translationStatus(
      {cms: new CmsClient(requireCms(config)), siteLocales: graph ? () => instanceLocales(graph) : null},
      p.key,
    );
  },
  coverage: (config) => coverage(requireGraph(config)),
};

export class CmsUiExtension extends App.Function {
  public async perform(): Promise<App.Response> {
    const body = (this.request.bodyJSON ?? {}) as RequestBody;
    const action = typeof body.action === 'string' ? body.action : '';
    if (!isAction(action)) return new App.Response(400, fail('unknown_action', action.slice(0, 64)));

    // Everything inside the try: a throw that escapes perform() reaches the editor as an
    // empty "[ExtensionService] Failed to invoke function:".
    try {
      const raw = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};
      const params = PARSERS[action](raw as Record<string, unknown>);
      const handler = HANDLERS[action] as (config: LoadedConfig, params: unknown) => Promise<unknown>;
      return new App.Response(200, ok(await handler(await loadConfig(), params)));
    } catch (error) {
      if (error instanceof ActionError) return new App.Response(400, fail(error.code, error.message));
      if (error instanceof NotConfiguredError) return new App.Response(412, fail('not_configured', error.message));
      if (error instanceof ApiError) {
        logger.warn('Upstream API error', action, error.code, error.message);
        return new App.Response(502, fail(error.code, error.message));
      }
      logger.error('CmsUiExtension failure', action, error);
      return new App.Response(500, fail('internal_error'));
    }
  }
}
