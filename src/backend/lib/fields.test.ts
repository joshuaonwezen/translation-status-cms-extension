import {describe, expect, it} from 'vitest';

import {compareFields, localizedFields, textOf, type TypeInfo, type VersionContent} from './fields';

const TYPES: Record<string, TypeInfo> = {
  DynamicExperience: {properties: {metaTitle: {displayName: 'Meta title', type: 'string', isLocalized: true}}},
  HeroBlock: {
    displayName: 'Hero',
    properties: {
      headline: {displayName: 'Headline', type: 'string', isLocalized: true},
      body: {displayName: 'Body', type: 'richText', isLocalized: true},
      variant: {displayName: 'Variant', type: 'string', isLocalized: false},
      cards: {displayName: 'Cards', type: 'array'},
    },
  },
  CardBlock: {displayName: 'Card', properties: {title: {displayName: 'Title', type: 'string', isLocalized: true}}},
};
const types = (k: string | undefined) => (k ? TYPES[k] : undefined);

const version = (headline: string, body: string, cardTitle: string, nodeId = 'n1'): VersionContent => ({
  contentType: 'DynamicExperience',
  properties: {metaTitle: {value: 'Mosey Bank'}},
  composition: {
    nodeType: 'experience',
    nodes: [
      {
        id: nodeId,
        nodeType: 'component',
        displayName: 'Home Hero',
        component: {
          contentType: 'HeroBlock',
          properties: {
            headline: {value: headline},
            body: {value: {html: body}},
            variant: {value: 'dark'},
            cards: {value: [{contentType: 'CardBlock', properties: {title: {value: cardTitle}}}, {reference: 'cms://content/x'}]},
          },
        },
      },
    ],
  },
});

describe('localizedFields', () => {
  it('lists the localized text fields of the page and its inline blocks, not the others', () => {
    const fields = localizedFields(version('Banking built around you', '<p>Hello <b>there</b></p>', 'Savings'), types);
    expect(fields.map((f) => [f.where, f.label, f.text])).toEqual([
      ['', 'Meta title', 'Mosey Bank'],
      ['Home Hero', 'Headline', 'Banking built around you'],
      ['Home Hero', 'Body', 'Hello there'],
      ['Home Hero > Card', 'Title', 'Savings'],
    ]);
  });

  it('counts a field the version leaves out as empty', () => {
    const fields = localizedFields({contentType: 'DynamicExperience', properties: {}}, types);
    expect(fields).toMatchObject([{label: 'Meta title', text: ''}]);
  });
});

describe('compareFields', () => {
  const en = localizedFields(version('Banking built around you', '<p>Straightforward accounts.</p>', 'Savings'), types);

  it('sorts fields into translated, empty and same as the source', () => {
    const nl = localizedFields(version('Bankieren rond jou', '', 'Savings'), types);
    const cmp = compareFields(en, nl);
    expect(cmp.total).toBe(4);
    expect(cmp.translated).toBe(1);
    expect(cmp.empty.map((f) => f.label)).toEqual(['Body']);
    expect(cmp.same.map((f) => f.label)).toEqual(['Meta title', 'Title']);
  });

  it('falls back to position when a language version has new node ids', () => {
    const nl = localizedFields(version('Bankieren rond jou', '<p>Eenvoudig.</p>', 'Sparen', 'other-id'), types);
    expect(compareFields(en, nl)).toMatchObject({translated: 3, empty: []});
  });
});

describe('textOf', () => {
  it('reads strings, HTML and rich text JSON', () => {
    expect(textOf('  plain ')).toBe('plain');
    expect(textOf({html: '<p>A&nbsp;&amp; B</p>'})).toBe('A & B');
    expect(textOf({json: {children: [{text: 'One'}, {children: [{text: 'two'}]}]}})).toBe('One two');
    expect(textOf(null)).toBe('');
  });
});
