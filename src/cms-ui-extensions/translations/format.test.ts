import {describe, expect, it} from 'vitest';

import {count, percent, shortDate} from './format';

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

describe('count and percent', () => {
  it('pluralizes', () => {
    expect(count(1, 'field')).toBe('1 field');
    expect(count(1200, 'page')).toBe('1,200 pages');
  });

  it('never rounds real progress down to 0%', () => {
    expect(percent(1, 660)).toBe('<1%');
    expect(percent(0, 660)).toBe('0%');
    expect(percent(2, 110)).toBe('2%');
    expect(percent(3, 0)).toBe('0%');
  });
});
