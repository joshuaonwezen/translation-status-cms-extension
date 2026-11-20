// The contract between the sidebar/view and the cms_extension function. The UI sends
// {action, params}; the function answers with an Envelope.

export type Envelope<T> =
  | {ok: true; result: T}
  | {ok: false; error: string; message?: string};

/** A language of the site: its code ("fr", "ja-JP") and the name the CMS shows for it. */
export interface Language {
  code: string;
  name: string;
}

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
  name: string;
  state: LocaleState;
  lastModified: string | null;
  /** Last changed before the source language's published version. */
  olderThanSource: boolean;
  empty: FieldRef[];
  same: FieldRef[];
  /** Translated, but the source text changed after this language was last changed. */
  changed: FieldRef[];
  translated: number;
  total: number;
}

/**
 * Where the language list came from. site: the CMS's (or Graph's) list of the site's
 * languages, so languages the item isn't in yet are listed too. item: only the item's own
 * languages, because neither could be read.
 */
export type LanguageSource = 'site' | 'item';

export interface TranslationStatus {
  key: string;
  displayName: string;
  /**
   * The language the item was created in; the others are compared with its published
   * version, or with its newest draft when it was never published (null: no version at all).
   */
  source: {locale: string; name: string; compared: 'published' | 'draft' | null; lastModified: string | null; empty: FieldRef[]};
  locales: LocaleRow[];
  languages: LanguageSource;
}

export type StatusOutcome = {kind: 'status'; status: TranslationStatus} | {kind: 'nothing'; reason: string};

/**
 * published: published and up to date. stale: published, but older than the source.
 * draft: only unpublished versions. missing: no version.
 */
export type CoverageState = 'published' | 'stale' | 'draft' | 'missing';

export interface CoverageCell {
  state: CoverageState;
  lastModified: string | null;
  /** Published, with a newer unpublished version waiting (an update in progress). */
  pending: boolean;
}

export interface CoverageRow {
  key: string;
  displayName: string;
  url: string | null;
  sourceModified: string | null;
  locales: Record<string, CoverageCell>;
}

export interface CoverageTotals {
  published: number;
  stale: number;
  draft: number;
  missing: number;
}

/**
 * Where unpublished versions came from. cms: the CMS API, so drafts show as drafts.
 * no_cms / failed: Graph only, so a language with only a draft counts as missing.
 */
export type DraftSource = 'cms' | 'no_cms' | 'failed';

export interface Coverage {
  /** The site's languages, source first. */
  languages: Language[];
  source: string;
  pages: number;
  totals: Record<string, CoverageTotals>;
  /** Pages with the most work left first. */
  rows: CoverageRow[];
  /** Graph had more than MAX_PUBLISHED_ENTRIES published page languages; the rest weren't read. */
  truncated: boolean;
  drafts: DraftSource;
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
