// The contract between the sidebar/view and the cms_extension function. The UI sends
// {action, params}; the function answers with an Envelope.

export type Envelope<T> =
  | {ok: true; result: T}
  | {ok: false; error: string; message?: string};

export interface FieldRef {
  label: string;
  /** The block it belongs to; '' for the item's own fields. */
  where: string;
}

/**
 * published: visitors see it. changes: published, with a newer unpublished version.
 * draft: never published. missing: no version in this language.
 */
export type LocaleState = 'published' | 'changes' | 'draft' | 'missing';

export interface LocaleRow {
  locale: string;
  state: LocaleState;
  version: string | null;
  lastModified: string | null;
  /** Last changed before the source language's published version. */
  olderThanSource: boolean;
  empty: FieldRef[];
  same: FieldRef[];
  translated: number;
  total: number;
}

export interface TranslationStatus {
  key: string;
  displayName: string;
  /** The language the item was created in; the others are compared with its published version. */
  source: {locale: string; version: string | null; lastModified: string | null; fields: number; empty: FieldRef[]};
  locales: LocaleRow[];
}

export type StatusOutcome = {kind: 'status'; status: TranslationStatus} | {kind: 'nothing'; reason: string};

export type CoverageState = 'published' | 'stale' | 'missing';

export interface CoverageRow {
  key: string;
  displayName: string;
  url: string | null;
  sourceModified: string | null;
  locales: Record<string, {state: CoverageState; lastModified: string | null}>;
}

export interface Coverage {
  /** The instance's languages, source first. */
  locales: string[];
  source: string;
  pages: number;
  totals: Record<string, {published: number; stale: number}>;
  /** Pages missing a language or with a stale one first. */
  rows: CoverageRow[];
  checkedAt: string;
}

export type ActionParams = {
  translationStatus: {key: string; locale: string};
  coverage: Record<string, never>;
};

export type ActionResults = {
  translationStatus: StatusOutcome;
  coverage: Coverage;
};

export type ActionName = keyof ActionParams;
