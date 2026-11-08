import {
  Alert,
  AxiomProvider,
  Box,
  Button,
  Group,
  Heading,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from '@optiaxiom/react';
import {register, type ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import type {Coverage, CoverageState} from '@shared/types';
import {useCallback, useEffect, useState} from 'react';

import {call, errorMessage, isNotConfigured} from '../common/api';
import {CHART_STYLE, CoverageBars} from './charts';

const MAX_ROWS = 200;

const CELL: Record<CoverageState, {text: string; color: 'fg.default' | 'fg.warning' | 'fg.tertiary'}> = {
  published: {text: 'Published', color: 'fg.default'},
  stale: {text: 'Older', color: 'fg.warning'},
  missing: {text: '-', color: 'fg.tertiary'},
};

function TranslationCoverage({context}: {context: ExtensionContext}) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [onlyGaps, setOnlyGaps] = useState(true);

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

  const others = coverage ? coverage.locales.filter((l) => l !== coverage.source) : [];
  const rows = coverage
    ? coverage.rows.filter((r) => !onlyGaps || Object.values(r.locales).some((l) => l.state !== 'published'))
    : [];

  return (
    <AxiomProvider>
      <style>{CHART_STYLE}</style>
      <Box p="24">
        <Group flexDirection="column" gap="16">
          <Group alignItems="center" justifyContent="space-between">
            <Group flexDirection="column" gap="4">
              <Heading level="2">Translations</Heading>
              <Text color="fg.secondary">
                Published pages per language
                {coverage ? ` · ${coverage.pages} pages, source language ${coverage.source}` : ''}. A language with only a
                draft counts as missing here.
              </Text>
            </Group>
            <Button loading={loading} onClick={() => void load()}>
              Refresh
            </Button>
          </Group>

          {error ? (
            <Alert intent={isNotConfigured(error) ? 'warning' : 'danger'}>
              <Text fontSize="sm">
                {errorMessage(error)}
                {isNotConfigured(error) ? " Fill them in on the Translation status app's settings page." : ''}
              </Text>
            </Alert>
          ) : null}
          {!coverage && !error && <Spinner />}

          {coverage && others.length === 0 && (
            <Alert intent="information">
              <Text fontSize="sm">This instance has only one language ({coverage.source}).</Text>
            </Alert>
          )}

          {coverage && others.length > 0 && (
            <div className="viz-root" style={{maxWidth: 640}}>
              <CoverageBars
                rows={others.map((l) => ({
                  label: l,
                  value: coverage.totals[l]?.published ?? 0,
                  total: coverage.pages,
                  note: coverage.totals[l]?.stale ? `${coverage.totals[l].stale} older than ${coverage.source}` : undefined,
                }))}
              />
            </div>
          )}

          {coverage && others.length > 0 && (
            <>
              <Switch checked={onlyGaps} onCheckedChange={setOnlyGaps}>
                Only pages missing a language or with an older one ({rows.length})
              </Switch>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Page</TableHeaderCell>
                    <TableHeaderCell>{coverage.source} updated</TableHeaderCell>
                    {others.map((l) => (
                      <TableHeaderCell key={l}>{l}</TableHeaderCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, MAX_ROWS).map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Text fontSize="sm">{row.displayName}</Text>
                        {row.url && (
                          <Text color="fg.tertiary" fontSize="xs">
                            {row.url}
                          </Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <Text fontSize="sm">{row.sourceModified ? new Date(row.sourceModified).toLocaleDateString() : '-'}</Text>
                      </TableCell>
                      {others.map((l) => {
                        const cell = row.locales[l] ?? {state: 'missing' as const, lastModified: null};
                        return (
                          <TableCell key={l}>
                            <Text color={CELL[cell.state].color} fontSize="sm" title={cell.lastModified ? new Date(cell.lastModified).toLocaleString() : undefined}>
                              {CELL[cell.state].text}
                            </Text>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > MAX_ROWS && (
                <Text color="fg.tertiary" fontSize="xs">
                  Showing the first {MAX_ROWS} of {rows.length}.
                </Text>
              )}
            </>
          )}
        </Group>
      </Box>
    </AxiomProvider>
  );
}

register((context) => <TranslationCoverage context={context} />);
