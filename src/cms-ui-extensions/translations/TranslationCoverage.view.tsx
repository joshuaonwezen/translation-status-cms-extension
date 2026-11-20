import {Alert, AxiomProvider, Box, Button, Group, Input, Spinner, Switch, Text} from '@optiaxiom/react';
import {register, type ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import {MAX_PUBLISHED_ENTRIES} from '@shared/constants';
import type {Coverage, CoverageCell, CoverageRow, CoverageTotals, Language} from '@shared/types';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {call, errorMessage, isNotConfigured} from '../common/api';
import {count, percent, shortDate} from './format';
import {LanguageName, Legend, StackedBar, StateChip, StateIcon, STATE_LABEL, STYLE} from './ui';

const PAGE_SIZE = 50;

const needsWork = (c: CoverageCell | undefined) => !c || c.state !== 'published';

function tally(rows: CoverageRow[], code: string): CoverageTotals {
  const t: CoverageTotals = {published: 0, stale: 0, draft: 0, missing: 0};
  for (const r of rows) t[r.locales[code]?.state ?? 'missing']++;
  return t;
}

function cellTitle(cell: CoverageCell, language: Language): string {
  const when = cell.lastModified ? ` · last changed ${shortDate(cell.lastModified)}` : '';
  if (cell.state === 'missing') return `No ${language.name} version yet`;
  if (cell.state === 'draft') return `Only a draft in ${language.name}, not published yet${when}`;
  const pending = cell.pending ? ' · a newer draft is waiting' : '';
  if (cell.state === 'stale') return `Published, but older than the source${when}${pending}`;
  return `Published and up to date${when}${pending}`;
}

function Cell({cell, language}: {cell: CoverageCell; language: Language}) {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
      <StateChip state={cell.state} title={cellTitle(cell, language)} />
      {cell.pending && (
        <span className="tx-chip" data-state="draft" title="A newer draft is waiting">
          <StateIcon size={12} state="draft" />
        </span>
      )}
    </span>
  );
}

function TranslationCoverage({context}: {context: ExtensionContext}) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [onlyWork, setOnlyWork] = useState(true);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCoverage(await call(context, 'coverage', {}));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void context.extension.setReady();
    void load();
  }, [context, load]);

  const source = coverage?.languages.find((l) => l.code === coverage.source) ?? null;
  const others = useMemo(() => (coverage ? coverage.languages.filter((l) => l.code !== coverage.source) : []), [coverage]);
  const focus = others.find((l) => l.code === language) ?? null;

  const rows = useMemo(() => {
    if (!coverage) return [];
    const q = query.trim().toLowerCase();
    return coverage.rows.filter((r) => {
      if (q && !r.displayName.toLowerCase().includes(q) && !(r.url ?? '').toLowerCase().includes(q)) return false;
      if (!onlyWork) return true;
      return focus ? needsWork(r.locales[focus.code]) : others.some((l) => needsWork(r.locales[l.code]));
    });
  }, [coverage, query, onlyWork, focus, others]);

  // A new filter starts from the top.
  useEffect(() => setShown(PAGE_SIZE), [query, onlyWork, language]);

  const totals = useMemo(() => new Map(others.map((l) => [l.code, tally(coverage?.rows ?? [], l.code)])), [coverage, others]);
  const overall = useMemo(() => {
    const t: CoverageTotals = {published: 0, stale: 0, draft: 0, missing: 0};
    for (const v of totals.values()) for (const k of Object.keys(t) as Array<keyof CoverageTotals>) t[k] += v[k];
    return t;
  }, [totals]);
  const slots = (coverage?.pages ?? 0) * others.length;

  const visible = rows.slice(0, shown);

  return (
    <AxiomProvider>
      <style>{STYLE}</style>
      <Box className="tx" p="24">
        <Group flexDirection="column" gap="24">
          <Group alignItems="start" gap="16" justifyContent="space-between">
            <Group flexDirection="column" gap="4">
              <Text fontSize="lg" fontWeight="600">
                {coverage && source ? `${count(coverage.pages, 'published page')} in ${source.name}` : 'Translations across the site'}
              </Text>
              <Text color="fg.secondary" fontSize="sm">
                {coverage && source
                  ? `${source.name} is the source: every other language is compared with it. ${
                      coverage.drafts === 'cms' ? 'Drafts come from the CMS, so work in progress shows up here.' : ''
                    }`
                  : 'Which pages are translated into each language, and which are out of date.'}
              </Text>
            </Group>
            <Button appearance="subtle" loading={loading} onClick={() => void load()} size="sm">
              Refresh
            </Button>
          </Group>

          {error ? (
            <Alert intent={isNotConfigured(error) ? 'warning' : 'danger'}>
              <Group flexDirection="column" gap="8">
                <Text fontSize="sm">
                  {isNotConfigured(error)
                    ? "This page needs the site's Optimizely Graph key to count published pages. Ask a CMS admin to add it on this app's settings page."
                    : errorMessage(error)}
                </Text>
                {!isNotConfigured(error) && (
                  <Button onClick={() => void load()} size="sm">
                    Retry
                  </Button>
                )}
              </Group>
            </Alert>
          ) : null}
          {!coverage && !error && (
            <Group gap="8">
              <Spinner size="sm" />
              <Text color="fg.secondary" fontSize="sm">
                Reading every page in every language…
              </Text>
            </Group>
          )}

          {coverage && coverage.drafts !== 'cms' && (
            <Alert intent="information">
              <Text fontSize="sm">
                {coverage.drafts === 'failed'
                  ? "The CMS didn't answer, so drafts aren't counted this time: a language that only has a draft shows as not translated. Refresh to try again."
                  : "Drafts aren't counted: a language that only has a draft shows as not translated. A CMS admin can add the CMS API client on this app's settings page to include them."}
              </Text>
            </Alert>
          )}
          {coverage?.truncated && (
            <Alert intent="warning">
              <Text fontSize="sm">
                This site has more than {MAX_PUBLISHED_ENTRIES.toLocaleString('en-GB')} published page languages. Only the first{' '}
                {MAX_PUBLISHED_ENTRIES.toLocaleString('en-GB')} were read, so the numbers below are incomplete.
              </Text>
            </Alert>
          )}
          {coverage && others.length === 0 && (
            <Alert intent="information">
              <Text fontSize="sm">This site has only one language, {source?.name ?? coverage.source}, so there is nothing to translate.</Text>
            </Alert>
          )}

          {coverage && others.length > 0 && (
            <>
              <div className="tx-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))'}}>
                {(
                  [
                    ['published', 'Up to date', `${percent(overall.published, slots)} of ${count(slots, 'page translation')}`],
                    ['draft', 'Drafts', 'not published yet'],
                    ['stale', 'Out of date', 'source changed since'],
                    ['missing', 'Not started', 'no version yet'],
                  ] as const
                ).map(([state, label, note]) => (
                  <div className="tx-tile" key={state}>
                    <div className="tx-tile-label">
                      <span className="tx-chip" data-state={state} style={{padding: 2}}>
                        <StateIcon size={12} state={state} />
                      </span>
                      {label}
                    </div>
                    <div className="tx-tile-value">{overall[state].toLocaleString('en-GB')}</div>
                    <div className="tx-faint" style={{fontSize: 12}}>
                      {note}
                    </div>
                  </div>
                ))}
              </div>

              <Group flexDirection="column" gap="8">
                <Text fontSize="sm" fontWeight="600">
                  By language
                </Text>
                <div className="tx-grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'}}>
                  {others.map((l) => {
                    const t = totals.get(l.code)!;
                    const pressed = language === l.code;
                    return (
                      <button
                        aria-pressed={pressed}
                        className="tx-card"
                        key={l.code}
                        onClick={() => setLanguage(pressed ? null : l.code)}
                        title={pressed ? 'Show every language' : `Show only ${l.name}`}
                        type="button"
                      >
                        <LanguageName code={l.code} name={l.name} />
                        <div style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
                          <span style={{fontSize: 20, fontWeight: 600, lineHeight: '24px'}}>{percent(t.published, coverage.pages)}</span>
                          <span className="tx-muted" style={{fontSize: 12}}>
                            up to date
                          </span>
                        </div>
                        <StackedBar pages={coverage.pages} totals={t} />
                        <Legend compact totals={t} />
                      </button>
                    );
                  })}
                </div>
              </Group>

              <Group flexDirection="column" gap="12">
                <Group alignItems="center" flexWrap="wrap" gap="16" justifyContent="space-between">
                  <Group alignItems="center" flexWrap="wrap" gap="16">
                    <div style={{width: 280}}>
                      <Input onChange={(e) => setQuery(e.target.value)} placeholder="Find a page by name or URL" value={query} />
                    </div>
                    <Switch checked={onlyWork} onCheckedChange={setOnlyWork}>
                      Only pages with work left
                    </Switch>
                    {focus && (
                      <Button appearance="subtle" onClick={() => setLanguage(null)} size="sm">
                        Showing {focus.name} only · show all languages
                      </Button>
                    )}
                  </Group>
                  <Text color="fg.secondary" fontSize="sm">
                    {count(rows.length, 'page')}
                  </Text>
                </Group>

                {rows.length === 0 ? (
                  <Text color="fg.secondary">
                    {query
                      ? 'No page matches that search.'
                      : onlyWork
                        ? `Every page is published and up to date in ${focus ? focus.name : 'every language'}.`
                        : 'There are no published pages yet.'}
                  </Text>
                ) : (
                  <div style={{overflowX: 'auto'}}>
                    <table className="tx-table">
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>{source?.name ?? coverage.source} changed</th>
                          {(focus ? [focus] : others).map((l) => (
                            <th key={l.code} title={l.name}>
                              {focus ? `${l.name}` : l.code}
                            </th>
                          ))}
                          {focus && <th>{focus.name} changed</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                            <tr key={row.key}>
                              <td style={{minWidth: 220}}>
                                <div style={{fontWeight: 500}}>{row.displayName}</div>
                                {row.url && <div className="tx-path">{row.url}</div>}
                              </td>
                              <td className="tx-num">{shortDate(row.sourceModified) || '–'}</td>
                              {(focus ? [focus] : others).map((l) => (
                                <td key={l.code}>
                                  <Cell cell={row.locales[l.code] ?? {state: 'missing', lastModified: null, pending: false}} language={l} />
                                </td>
                              ))}
                              {focus && <td className="tx-num">{shortDate(row.locales[focus.code]?.lastModified) || '–'}</td>}
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {rows.length > shown && (
                  <Group gap="12">
                    <Button onClick={() => setShown((n) => n + PAGE_SIZE)} size="sm">
                      Show {Math.min(PAGE_SIZE, rows.length - shown)} more
                    </Button>
                    <Text color="fg.secondary" fontSize="sm">
                      Showing {shown} of {rows.length}
                    </Text>
                  </Group>
                )}
                <div className="tx-legend" style={{gap: '4px 16px'}}>
                  {(['published', 'draft', 'stale', 'missing'] as const).map((s) => (
                    <span key={s}>
                      <StateChip state={s} />
                      {s === 'missing' ? STATE_LABEL.missing : ''}
                    </span>
                  ))}
                  <span>
                    <span className="tx-chip" data-state="draft">
                      <StateIcon size={12} state="draft" />
                    </span>
                    a newer draft is waiting
                  </span>
                </div>
              </Group>
            </>
          )}
        </Group>
      </Box>
    </AxiomProvider>
  );
}

register((context) => <TranslationCoverage context={context} />);
