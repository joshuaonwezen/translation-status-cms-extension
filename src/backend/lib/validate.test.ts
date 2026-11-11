import {describe, expect, it} from 'vitest';

import {contentKey, isAction, PARSERS} from './validate';

const KEY = '0f8e2d6c4b1a49e7a3c5d7f9b2e4c6a8';

describe('contentKey', () => {
  it('accepts the dashed, upper-case form the editor can report', () => {
    expect(contentKey('0F8E2D6C-4b1a-49e7-a3c5-d7f9b2e4c6a8')).toBe(KEY);
    expect(contentKey(` ${KEY} `)).toBe(KEY);
  });

  it('rejects anything that is not a content key before it reaches a CMS URL', () => {
    expect(() => contentKey('../../v1/contenttypes')).toThrow(/content key/);
    expect(() => contentKey(`${KEY}/versions`)).toThrow(/content key/);
    expect(() => contentKey('0f8e2d6c4b1a49e7a3c5d7f9b2e4c6az')).toThrow(/content key/);
    expect(() => contentKey('a'.repeat(65))).toThrow(/at most 64/);
    expect(() => contentKey(42)).toThrow(/expected text/);
    expect(() => contentKey(undefined)).toThrow(/required/);
  });
});

describe('PARSERS', () => {
  it('keeps the key only, so the ignored locale is not part of the contract', () => {
    expect(PARSERS.translationStatus({key: KEY, locale: 'nl', extra: 1})).toEqual({key: KEY});
  });

  it('takes no parameters for the view', () => {
    expect(PARSERS.coverage({anything: 'x'})).toEqual({});
  });

  it('knows its two actions and nothing inherited from Object', () => {
    expect(isAction('translationStatus')).toBe(true);
    expect(isAction('coverage')).toBe(true);
    expect(isAction('toString')).toBe(false);
    expect(isAction('publish')).toBe(false);
  });
});
