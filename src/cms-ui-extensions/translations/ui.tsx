import {Tooltip} from '@optiaxiom/react';
import type {CoverageState, CoverageTotals} from '@shared/types';
import type {ReactNode} from 'react';

import {count, percent} from './format';

// Colors by job: up to date, draft and out of date are three states of one page, shown as
// segments of one bar, so they are validated as a set (dataviz validator, light, on
// #ffffff: lightness band, chroma, CVD and normal-vision separation, and 3:1 contrast all
// PASS for green #0ca30c | blue #2a78d6 | amber #c98400 in that order). Not started is the
// track. Green and amber only touch when there are no drafts, so the segments keep that
// order and a 2px surface gap, and every state also carries an icon and a label.
//
// Only the light theme plus an explicit data-theme="dark": the CMS host is light, and
// following the OS setting (prefers-color-scheme) painted dark tracks and white labels on
// a light page.
export const STYLE = `
.tx {
  --tx-surface: #ffffff;
  --tx-raised: #fafaf8;
  --tx-line: #e4e3df;
  --tx-line-strong: #b9b7b0;
  --tx-ink: #0b0b0b;
  --tx-ink-2: #52514e;
  --tx-ink-3: #77756f;
  --tx-good: #0ca30c;
  --tx-draft: #2a78d6;
  --tx-stale: #c98400;
  --tx-track: #ecebe7;
  --tx-good-text: #0b6e0b;
  --tx-draft-text: #1d5aa6;
  --tx-stale-text: #8a5a00;
  --tx-good-bg: #e8f6e8;
  --tx-draft-bg: #e8f1fc;
  --tx-stale-bg: #fdf3df;
  --tx-focus: #2a78d6;
  color: var(--tx-ink);
}
:root[data-theme="dark"] .tx {
  --tx-surface: #1a1a19;
  --tx-raised: #222220;
  --tx-line: #3a3936;
  --tx-line-strong: #6b6a65;
  --tx-ink: #f0efec;
  --tx-ink-2: #c3c2b7;
  --tx-ink-3: #a3a29a;
  --tx-good: #2fbf2f;
  --tx-draft: #3987e5;
  --tx-stale: #e0a32a;
  --tx-track: #34332f;
  --tx-good-text: #7fd97f;
  --tx-draft-text: #8cb8f0;
  --tx-stale-text: #f0c070;
  --tx-good-bg: #1d3320;
  --tx-draft-bg: #1b2b40;
  --tx-stale-bg: #3a2e14;
}
.tx-muted { color: var(--tx-ink-2); }
.tx-faint { color: var(--tx-ink-3); }
.tx-code {
  font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--tx-ink-2);
  border: 1px solid var(--tx-line);
  border-radius: 4px;
  padding: 2px 4px;
  white-space: nowrap;
}
.tx-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; line-height: 18px; font-weight: 500;
  padding: 1px 8px 1px 6px; border-radius: 999px; white-space: nowrap;
}
.tx-chip svg { flex: none; }
.tx-chip[data-state="published"] { color: var(--tx-good-text); background: var(--tx-good-bg); }
.tx-chip[data-state="draft"] { color: var(--tx-draft-text); background: var(--tx-draft-bg); }
.tx-chip[data-state="stale"] { color: var(--tx-stale-text); background: var(--tx-stale-bg); }
.tx-chip[data-state="missing"] { color: var(--tx-ink-3); background: transparent; padding-left: 2px; }
.tx-table .tx-chip[data-state="missing"] { color: var(--tx-line-strong); }
.tx-meter { height: 6px; border-radius: 3px; background: var(--tx-track); overflow: hidden; }
.tx-meter > span { display: block; height: 100%; border-radius: 3px; background: var(--tx-good); }
.tx-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; font-size: 14px; }
.tx-row + .tx-row { border-top: 1px solid var(--tx-line); padding-top: 4px; }
.tx-bar { display: flex; gap: 2px; height: 8px; border-radius: 4px; overflow: hidden; background: var(--tx-surface); }
.tx-bar > span { display: block; height: 100%; }
.tx-bar > span:first-child { border-radius: 4px 0 0 4px; }
.tx-bar > span:last-child { border-radius: 0 4px 4px 0; }
.tx-bar > span:only-child { border-radius: 4px; }
.tx-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--tx-ink-2); }
.tx-legend span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.tx-swatch { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.tx-card {
  border: 1px solid var(--tx-line); border-radius: 8px; background: var(--tx-surface);
  padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0;
}
button.tx-card { font: inherit; color: inherit; text-align: left; cursor: pointer; }
button.tx-card:hover { border-color: var(--tx-ink-3); }
button.tx-card:focus-visible { outline: 2px solid var(--tx-focus); outline-offset: 1px; }
button.tx-card[aria-pressed="true"] { border-color: var(--tx-draft); box-shadow: 0 0 0 1px var(--tx-draft); }
.tx-tile { border: 1px solid var(--tx-line); border-radius: 8px; padding: 12px 14px; background: var(--tx-surface); }
.tx-tile-value { font-size: 24px; line-height: 32px; font-weight: 600; }
.tx-tile-label { font-size: 13px; color: var(--tx-ink-2); display: flex; align-items: center; gap: 6px; }
.tx-grid { display: grid; gap: 12px; }
.tx-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.tx-table th {
  text-align: left; font-weight: 600; font-size: 12px; color: var(--tx-ink-2);
  padding: 8px 10px; border-bottom: 1px solid var(--tx-line); white-space: nowrap;
  position: sticky; top: 0; background: var(--tx-surface); z-index: 1;
}
.tx-table td { padding: 8px 10px; border-bottom: 1px solid var(--tx-line); vertical-align: middle; }
.tx-table tbody tr:hover td { background: var(--tx-raised); }
.tx-table .tx-num { font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--tx-ink-2); }
.tx-path { color: var(--tx-ink-3); font-size: 12px; overflow-wrap: anywhere; }
.tx-fieldlist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.tx-fieldlist li { font-size: 12px; display: flex; gap: 6px; align-items: baseline; }
.tx-fieldlist .tx-where { color: var(--tx-ink-3); }
.tx-tag { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; color: var(--tx-ink-3); }
`;

const ICON: Record<CoverageState, ReactNode> = {
  // Check, pencil, circular arrow, dash: the state reads without its color.
  published: <path d="M3.5 8.5l3 3 6-7" />,
  draft: <path d="M10.5 3.5l2 2-6.5 6.5H4v-2zM9 5l2 2" />,
  stale: <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10" />,
  missing: <path d="M4.5 8h7" />,
};

export function StateIcon({state, size = 14}: {state: CoverageState; size?: number}) {
  return (
    <svg aria-hidden fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} viewBox="0 0 16 16" width={size}>
      {ICON[state]}
    </svg>
  );
}

export const STATE_LABEL: Record<CoverageState, string> = {
  published: 'Published',
  draft: 'Draft',
  stale: 'Out of date',
  missing: 'Not translated',
};

export function StateChip({state, label, title}: {state: CoverageState; label?: string; title?: string}) {
  const chip = (
    <span aria-label={state === 'missing' ? STATE_LABEL.missing : undefined} className="tx-chip" data-state={state}>
      <StateIcon state={state} />
      {label ?? (state === 'missing' ? '' : STATE_LABEL[state])}
    </span>
  );
  return title ? <Tooltip content={title}>{chip}</Tooltip> : chip;
}

const SEGMENTS: Array<{key: keyof CoverageTotals; color: string; label: string}> = [
  {key: 'published', color: 'var(--tx-good)', label: 'Up to date'},
  {key: 'draft', color: 'var(--tx-draft)', label: 'Draft'},
  {key: 'stale', color: 'var(--tx-stale)', label: 'Out of date'},
];

/** Up to date | draft | out of date on a track of the pages not started. */
export function StackedBar({totals, pages}: {totals: CoverageTotals; pages: number}) {
  const parts = SEGMENTS.filter((s) => totals[s.key] > 0);
  const rest = Math.max(0, pages - parts.reduce((n, s) => n + totals[s.key], 0));
  const title = [...parts.map((s) => `${s.label}: ${totals[s.key]}`), `Not translated: ${rest}`].join(' · ');
  return (
    <div aria-label={title} className="tx-bar" role="img" title={title}>
      {parts.map((s) => (
        <span key={s.key} style={{width: `${Math.max(1.5, (totals[s.key] / Math.max(pages, 1)) * 100)}%`, background: s.color}} />
      ))}
      {rest > 0 && <span style={{flex: 1, background: 'var(--tx-track)'}} />}
    </div>
  );
}

/** The bar's legend, with the counts: identity never rests on color alone. */
export function Legend({totals, compact, lead}: {totals: CoverageTotals; compact?: boolean; lead?: ReactNode}) {
  const items: Array<{state: CoverageState; n: number; label: string}> = [
    {state: 'published', n: totals.published, label: 'up to date'},
    {state: 'draft', n: totals.draft, label: totals.draft === 1 ? 'draft' : 'drafts'},
    {state: 'stale', n: totals.stale, label: 'out of date'},
    {state: 'missing', n: totals.missing, label: 'not started'},
  ];
  return (
    <div className="tx-legend">
      {lead}
      {items
        .filter((i) => !compact || i.n > 0)
        .map((i) => (
          <span key={i.state}>
            <span className="tx-swatch" style={{background: i.state === 'missing' ? 'var(--tx-track)' : `var(--tx-${i.state === 'published' ? 'good' : i.state})`}} />
            {i.n.toLocaleString('en-GB')} {i.label}
          </span>
        ))}
    </div>
  );
}

/** One share of a whole: translated fields of all fields. */
export function Meter({value, max, label, color = 'var(--tx-good)'}: {value: number; max: number; label: string; color?: string}) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div aria-label={label} aria-valuemax={max} aria-valuemin={0} aria-valuenow={value} className="tx-meter" role="meter">
      {share > 0 && <span style={{width: `${Math.max(2, share * 100)}%`, background: color}} />}
    </div>
  );
}

export function LanguageName({name, code}: {name: string; code: string}) {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0}}>
      <span style={{fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{name}</span>
      {name.toLowerCase() !== code.toLowerCase() && <span className="tx-code">{code}</span>}
    </span>
  );
}

export {count, percent};
