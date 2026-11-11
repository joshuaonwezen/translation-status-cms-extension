const namers = new Map<string, Intl.DisplayNames>();

function browserLocale(): string {
  return (typeof navigator !== 'undefined' && navigator.language) || 'en';
}

function namer(uiLocale: string): Intl.DisplayNames {
  let names = namers.get(uiLocale);
  if (!names) {
    try {
      names = new Intl.DisplayNames([uiLocale, 'en'], {type: 'language'});
    } catch {
      // Not a well-formed locale: name languages in English.
      names = new Intl.DisplayNames(['en'], {type: 'language'});
    }
    namers.set(uiLocale, names);
  }
  return names;
}

/** "Dutch" for nl, in the editor's own language; the code itself when it has no name. */
export function languageName(code: string, uiLocale = browserLocale()): string {
  try {
    const name = namer(uiLocale).of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : code;
  } catch {
    // RangeError: not a well-formed language code.
    return code;
  }
}

/** "Dutch (nl)", "Japanese (Japan, ja-JP)": the name with the code the CMS shows. */
export function languageLabel(code: string, uiLocale = browserLocale()): string {
  const name = languageName(code, uiLocale);
  if (name === code) return code;
  return name.endsWith(')') ? `${name.slice(0, -1)}, ${code})` : `${name} (${code})`;
}

/** "5 Nov", with the year when it isn't this year; '' when there is no date. */
export function shortDate(iso: string | null | undefined, uiLocale = browserLocale(), now = new Date()): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear() === now.getFullYear() ? {} : {year: 'numeric' as const};
  return date.toLocaleDateString(uiLocale, {day: 'numeric', month: 'short', ...year});
}
