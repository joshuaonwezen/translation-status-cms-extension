import type {ActionName, ActionParams} from '../../shared/types';
import {ActionError} from './errors';

// The content key ends up in CMS REST URL paths, so it is checked against an allow-list
// here, before any handler runs.

const CONTENT_KEY = /^[0-9a-f]{32}$/;

function invalid(field: string, why: string): never {
  throw new ActionError('invalid_input', `${field}: ${why}`);
}

function str(raw: unknown, field: string, max: number): string {
  if (raw === undefined || raw === null || raw === '') invalid(field, 'required.');
  if (typeof raw !== 'string') invalid(field, 'expected text.');
  if (raw.length > max) invalid(field, `at most ${max} characters.`);
  return raw;
}

/** 32 lowercase hex characters: the editor reports keys with or without dashes, in either case. */
export function contentKey(raw: unknown, field = 'key'): string {
  const key = str(raw, field, 64).trim().replace(/-/g, '').toLowerCase();
  if (!CONTENT_KEY.test(key)) invalid(field, 'not a CMS content key.');
  return key;
}

type Parsers = {[A in ActionName]: (raw: Record<string, unknown>) => ActionParams[A]};

const none = () => ({}) as Record<string, never>;

/** One parser per action: unknown fields are dropped, every kept field is checked. */
export const PARSERS: Parsers = {
  translationStatus: (p) => ({key: contentKey(p.key)}),
  coverage: none,
};

export function isAction(action: string): action is ActionName {
  return Object.prototype.hasOwnProperty.call(PARSERS, action);
}
