import type {Language} from '../../shared/types';
import type {CmsClient} from './cms';
import {type GraphConfig, instanceLocales} from './graph';

let english: Intl.DisplayNames | null = null;

/** "Dutch" for nl, "Japanese (Japan)" for ja-JP; the code itself when it has no name. */
export function englishName(code: string): string {
  try {
    english ??= new Intl.DisplayNames(['en'], {type: 'language'});
    const name = english.of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : code;
  } catch {
    // RangeError: not a well-formed language code.
    return code;
  }
}

/**
 * The site's enabled languages in the CMS's own order, named the way the CMS language
 * menu names them ("Deutsch", "français"). Without a CMS client: Graph's Locales enum,
 * named in English.
 */
export async function siteLanguages(cms: Pick<CmsClient, 'listLocales'> | null, graph: GraphConfig | null): Promise<Language[]> {
  if (cms) {
    const locales = await cms.listLocales();
    return locales
      .filter((l) => l.key && l.isEnabled !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((l) => ({code: l.key, name: l.displayName?.trim() || englishName(l.key)}));
  }
  if (graph) return (await instanceLocales(graph)).map((code) => ({code, name: englishName(code)}));
  throw new Error('No CMS client or Graph key to read the languages from');
}

/** The named language for `code` from `languages`, or an English name for it. */
export function languageOf(code: string, languages: Language[]): Language {
  return languages.find((l) => l.code.toLowerCase() === code.toLowerCase()) ?? {code, name: englishName(code)};
}
