import type {ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import {CMS_EXTENSION_FUNCTION_ID} from '@shared/constants';
import type {ActionName, ActionParams, ActionResults, Envelope} from '@shared/types';

export class CallError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'CallError';
    this.code = code;
  }
}

// What editors read. Upstream (cms_*, graph_*) codes never show the backend's message: it
// carries the raw HTTP status and response body, which belong in the app logs. Only
// not_configured and not_found come worded for editors.
const MESSAGES: Record<string, string> = {
  cms_unauthorized: "The CMS turned down this app's API client. Ask a CMS admin to check it on this app's settings page.",
  cms_rate_limited: 'The CMS is busy right now. Try again in a moment.',
  graph_unauthorized: "Optimizely Graph turned down this app's key. Ask a CMS admin to check it on this app's settings page.",
  graph_rate_limited: 'Optimizely Graph is busy right now. Try again in a moment.',
  invalid_input: "This panel couldn't tell which item is open. Reopen the item and try again.",
  unknown_action: 'This panel is out of step with its app. Reload the page.',
  internal_error: 'Something went wrong while checking translations. Try again.',
  backend_unreachable: "The app didn't answer. Try again in a moment.",
};

const SERVICE_MESSAGES: Record<string, string> = {
  cms: "The CMS didn't answer as expected. Try again in a moment.",
  graph: "Optimizely Graph didn't answer as expected. Try again in a moment.",
};

function plainMessage(code: string, message: string | undefined): string {
  const service = /^(cms|graph)_/.exec(code)?.[1];
  return MESSAGES[code] ?? ((service ? SERVICE_MESSAGES[service] : message) || MESSAGES.internal_error);
}

/** Calls one backend action; resolves with its result or throws CallError. */
export async function call<A extends ActionName>(
  context: ExtensionContext,
  action: A,
  params: ActionParams[A],
): Promise<ActionResults[A]> {
  // The CMS rejects with an empty "[ExtensionService] Failed to invoke function:" when the
  // backend throws instead of answering.
  const response = await context.extension.invokeFunction(CMS_EXTENSION_FUNCTION_ID, {action, params}).catch(() => {
    throw new CallError('backend_unreachable', MESSAGES.backend_unreachable);
  });
  const envelope = response.data as Envelope<ActionResults[A]> | undefined;
  if (envelope && typeof envelope === 'object' && 'ok' in envelope) {
    if (envelope.ok) return envelope.result;
    throw new CallError(envelope.error, plainMessage(envelope.error, envelope.message));
  }
  throw new CallError('request_failed', MESSAGES.backend_unreachable);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed.';
}

export function isNotConfigured(error: unknown): boolean {
  return error instanceof CallError && error.code === 'not_configured';
}
