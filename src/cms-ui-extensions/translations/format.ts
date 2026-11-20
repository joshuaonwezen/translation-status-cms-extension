// The panels' copy is English, so dates are too: "5 Nov", never the browser's own
// language mixed into English sentences.
const UI_LOCALE = 'en-GB';

/** "5 Nov", with the year when it isn't this year; '' when there is no date. */
export function shortDate(iso: string | null | undefined, uiLocale = UI_LOCALE, now = new Date()): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear() === now.getFullYear() ? {} : {year: 'numeric' as const};
  return date.toLocaleDateString(uiLocale, {day: 'numeric', month: 'short', ...year});
}

/** "1 field", "3 fields". */
export const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString(UI_LOCALE)} ${n === 1 ? one : many}`;

/** "42%", and "<1%" rather than a 0% that hides real progress. */
export function percent(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return '0%';
  const share = (part / whole) * 100;
  return share < 1 ? '<1%' : `${Math.round(share)}%`;
}
