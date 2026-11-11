import {describe, expect, it} from 'vitest';

import {contentKey, isAction, PARSERS} from './validate';

const KEY = '3525e1552b6f46158be2850ff6e6fb74';

describe('contentKey', () => {
  it('accepts the dashed, upper-case form the editor can report', () => {
    expect(contentKey('3525E155-2b6f-4615-8be2-850ff6e6fb74')).toBe(KEY);
    expect(contentKey(` ${KEY} `)).toBe(KEY);
  });

  it('rejects anything that is not a content key before it reaches a CMS URL', () => {
    expect(() => contentKey('../../v1/contenttypes')).toThrow(/content key/);
    expect(() => contentKey(`${KEY}/versions`)).toThrow(/content key/);
    expect(() => contentKey('3525e1552b6f46158be2850ff6e6fb7z')).toThrow(/content key/);
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
