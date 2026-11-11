import {describe, expect, it} from 'vitest';

import {languageLabel, languageName, shortDate} from './format';

describe('languageName', () => {
  it('names a language in the editor\'s own language', () => {
    expect(languageName('nl', 'en')).toBe('Dutch');
    expect(languageName('nl', 'nl')).toBe('Nederlands');
  });

  it('falls back to the code', () => {
    expect(languageName('xx', 'en')).toBe('xx');
    expect(languageName('', 'en')).toBe('');
    expect(languageName('not a code!', 'en')).toBe('not a code!');
    expect(languageName('de', 'not a locale!')).toBe('German');
  });
});

describe('languageLabel', () => {
  it('adds the code the CMS shows, inside any parentheses the name already has', () => {
    expect(languageLabel('nl', 'en')).toBe('Dutch (nl)');
    expect(languageLabel('ja-JP', 'en')).toBe('Japanese (Japan, ja-JP)');
    expect(languageLabel('xx', 'en')).toBe('xx');
  });
});

describe('shortDate', () => {
  const now = new Date('2026-11-11T12:00:00Z');

  it('leaves out the year only for this year', () => {
    expect(shortDate('2026-11-05T12:00:00Z', 'en-GB', now)).toBe('5 Nov');
    expect(shortDate('2025-11-05T12:00:00Z', 'en-GB', now)).toBe('5 Nov 2025');
  });

  it('is empty without a date', () => {
    expect(shortDate(null, 'en-GB', now)).toBe('');
    expect(shortDate('not a date', 'en-GB', now)).toBe('');
  });
});
