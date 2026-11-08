import {Group} from '@optiaxiom/react';

// Coverage bars, following the dataviz method: one hue (validated: #2a78d6 light on #ffffff,
// #3987e5 dark on #1a1a19, both PASS), each bar on a full-width track because coverage is a
// share of a fixed whole, a 4px rounded data end, values as direct labels in text tokens
// (never the series color), a title tooltip, and the page table below as the table view.

export const CHART_STYLE = `
.viz-root {
  --viz-surface: #ffffff;
  --viz-series: #2a78d6;
  --viz-track: #e6e5e1;
  --viz-text: #0b0b0b;
  --viz-text-secondary: #52514e;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    --viz-surface: #1a1a19;
    --viz-series: #3987e5;
    --viz-track: #34332f;
    --viz-text: #ffffff;
    --viz-text-secondary: #c3c2b7;
  }
}
:root[data-theme="dark"] .viz-root {
  --viz-surface: #1a1a19;
  --viz-series: #3987e5;
  --viz-track: #34332f;
  --viz-text: #ffffff;
  --viz-text-secondary: #c3c2b7;
}
`;

export function CoverageBars({rows}: {rows: Array<{label: string; value: number; total: number; note?: string}>}) {
  return (
    <Group flexDirection="column" gap="12">
      {rows.map((r) => {
        const share = r.total > 0 ? r.value / r.total : 0;
        const pct = Math.round(share * 100);
        return (
          <div key={r.label} title={`${r.label}: ${r.value} of ${r.total} pages published (${pct}%)`}>
            <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12}}>
              <span style={{color: 'var(--viz-text)', fontWeight: 600}}>{r.label}</span>
              <span style={{color: 'var(--viz-text-secondary)'}}>
                {r.value} of {r.total} pages · {pct}%{r.note ? ` · ${r.note}` : ''}
              </span>
            </div>
            <div style={{marginTop: 4, height: 8, borderRadius: 4, background: 'var(--viz-track)', overflow: 'hidden'}}>
              <div
                style={{
                  width: `${share > 0 ? Math.max(1, share * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--viz-series)',
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </div>
          </div>
        );
      })}
    </Group>
  );
}
