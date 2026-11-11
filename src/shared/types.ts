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
  lastModified: string | null;
  /** Last changed before the source language's published version. */
  olderThanSource: boolean;
  empty: FieldRef[];
  same: FieldRef[];
  translated: number;
  total: number;
}

/**
 * Where the language list came from. site: Graph's list of the site's languages, so
 * languages the item isn't in yet are listed too. no_graph_key and graph_failed: only the
 * item's own languages, because Graph couldn't be asked.
 */
export type LanguageSource = 'site' | 'no_graph_key' | 'graph_failed';

export interface TranslationStatus {
  key: string;
  displayName: string;
  /**
   * The language the item was created in; the others are compared with its published
   * version, or with its newest draft when it was never published (null: no version at all).
   */
  source: {locale: string; compared: 'published' | 'draft' | null; lastModified: string | null; empty: FieldRef[]};
  locales: LocaleRow[];
  languages: LanguageSource;
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
  /** Graph had more than MAX_PUBLISHED_ENTRIES published page languages; the rest weren't read. */
  truncated: boolean;
}

export type ActionParams = {
  translationStatus: {key: string};
  coverage: Record<string, never>;
};

export type ActionResults = {
  translationStatus: StatusOutcome;
  coverage: Coverage;
};

export type ActionName = keyof ActionParams;
