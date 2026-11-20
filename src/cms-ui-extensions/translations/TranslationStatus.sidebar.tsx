import {Alert, Button, Disclosure, DisclosureContent, DisclosureTrigger, Group, Text} from '@optiaxiom/react';
import {register, type ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import type {CoverageState, FieldRef, LocaleRow, StatusOutcome, TranslationStatus as Status} from '@shared/types';
import {useCallback, useEffect, useRef, useState} from 'react';

import {call} from '../common/api';
import {Frame} from '../common/Frame';
import {useContent} from '../common/useContent';
import {count, shortDate} from './format';
import {LanguageName, Meter, StateChip, StateIcon, STYLE} from './ui';

const fieldName = (f: FieldRef) => (f.where ? `${f.where} › ${f.label}` : f.label);

/** One chip per language: the view's states, so both panels speak the same words. */
function chipState(row: LocaleRow): CoverageState {
  if (row.state === 'missing') return 'missing';
  if (row.state === 'draft') return 'draft';
  return row.olderThanSource ? 'stale' : 'published';
}

function subtitle(status: Status): string | undefined {
  const when = status.source.lastModified ? ` ${shortDate(status.source.lastModified)}` : '';
  if (status.source.compared === 'published') return `Source: ${status.source.name}, published${when}`;
  if (status.source.compared === 'draft') return `Source: ${status.source.name}, a draft from${when} that isn't published yet`;
  return `Source: ${status.source.name}`;
}

function FieldGroup({title, fields}: {title: string; fields: FieldRef[]}) {
  if (fields.length === 0) return null;
  return (
    <Group flexDirection="column" gap="4">
      <span className="tx-tag">
        {title} · {fields.length}
      </span>
      <ul className="tx-fieldlist">
        {fields.map((f, i) => (
          <li key={`${fieldName(f)}-${i}`}>
            {f.where && <span className="tx-where">{f.where} ›</span>}
            <span>{f.label}</span>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function Locale({row, source, editing}: {row: LocaleRow; source: string; editing: boolean}) {
  const todo = row.empty.length + row.same.length + row.changed.length;
  const missing = row.state === 'missing';
  return (
    <div className="tx-card" style={editing ? {borderColor: 'var(--tx-draft)'} : undefined}>
      <Group alignItems="center" gap="8" justifyContent="space-between">
        <LanguageName code={row.locale} name={row.name} />
        <Group alignItems="center" gap="4">
          <StateChip state={chipState(row)} title={row.lastModified ? `Last changed ${shortDate(row.lastModified)}` : undefined} />
          {row.state === 'changes' && (
            <span className="tx-chip" data-state="draft" title="A newer draft is waiting">
              <StateIcon size={12} state="draft" />
            </span>
          )}
        </Group>
      </Group>
      {editing && (
        <Text color="fg.secondary" fontSize="xs">
          Open in the editor now
        </Text>
      )}

      {missing ? (
        <Text color="fg.secondary" fontSize="xs">
          Not translated yet: {count(row.total, 'field')} to translate.
        </Text>
      ) : (
        <Group flexDirection="column" gap="4">
          <Meter label={`${row.translated} of ${row.total} fields translated`} max={row.total} value={row.translated} />
          <Text color="fg.secondary" fontSize="xs">
            {row.translated} of {count(row.total, 'field')} translated
            {row.lastModified ? ` · changed ${shortDate(row.lastModified)}` : ''}
          </Text>
        </Group>
      )}

      {row.olderThanSource && !missing && (
        <Text fontSize="xs" style={{color: 'var(--tx-stale-text)'}}>
          {source} changed after this was last edited
          {row.changed.length ? `: ${count(row.changed.length, 'field')} to update` : '.'}
        </Text>
      )}

      {todo > 0 && !missing && (
        <Disclosure>
          <DisclosureTrigger>{count(todo, 'field')} to check</DisclosureTrigger>
          <DisclosureContent>
            <Group flexDirection="column" gap="8" pt="4">
              <FieldGroup fields={row.empty} title="Empty" />
              <FieldGroup fields={row.same} title={`Same as ${source}`} />
              <FieldGroup fields={row.changed} title={`Changed in ${source}`} />
            </Group>
          </DisclosureContent>
        </Disclosure>
      )}
    </div>
  );
}

/**
 * The languages the item isn't in yet, in one card. The CMS's own translate (More >
 * Translate) is how to add one; it lives in the editor and has no API, so the panel points
 * to it rather than starting it.
 */
function NotTranslated({rows, total, locale}: {rows: LocaleRow[]; total: number; locale: string}) {
  if (rows.length === 0) return null;
  return (
    <div className="tx-card">
      <Group alignItems="center" gap="8" justifyContent="space-between">
        <Text fontSize="sm" fontWeight="600">
          Not translated yet
        </Text>
        <Text color="fg.secondary" fontSize="xs">
          {count(total, 'field')} each
        </Text>
      </Group>
      <div>
        {rows.map((row) => (
          <div className="tx-row" key={row.locale}>
            <LanguageName code={row.locale} name={row.name} />
            {row.locale === locale && (
              <span className="tx-faint" style={{fontSize: 12}}>
                open now
              </span>
            )}
          </div>
        ))}
      </div>
      <Text color="fg.secondary" fontSize="xs">
        To add one, use the CMS&apos;s translate: More &gt; Translate, pick the language, and tick &quot;Translate content using AI&quot; to
        have it translated for you.
      </Text>
    </div>
  );
}

function HowItIsChecked({source}: {source: string}) {
  return (
    <Disclosure>
      <DisclosureTrigger>How this works</DisclosureTrigger>
      <DisclosureContent>
        <Group flexDirection="column" gap="8" pt="4">
          <Text color="fg.secondary" fontSize="xs">
            Each language&apos;s newest version is compared with the {source} version (the published one, when there is one), field by
            field. Only text fields set as translatable on their content type count, including those of blocks added inline in Visual Builder.
            Shared blocks are separate items with their own translations, and variations aren&apos;t compared.
          </Text>
          <Text color="fg.secondary" fontSize="xs">
            Same as {source}: word for word the {source} text. It may still need translating, or be a name that stays the same. Changed in{' '}
            {source}: the {source} text changed after this language was last edited.
          </Text>
        </Group>
      </DisclosureContent>
    </Disclosure>
  );
}

function Summary({status}: {status: Status}) {
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
      {status.locales.map((row) => (
        <span className="tx-chip" data-state={chipState(row)} key={row.locale} style={{paddingRight: 8}} title={row.name}>
          <StateIcon size={12} state={chipState(row)} />
          {row.locale}
        </span>
      ))}
    </div>
  );
}

function StatusBody({status, locale, busy, onRefresh}: {status: Status; locale: string; busy: boolean; onRefresh: () => void}) {
  const source = status.source.name;
  const empty = status.source.empty;
  return (
    <Group className="tx" flexDirection="column" gap="12">
      {status.locales.length > 0 && (
        <Group alignItems="center" gap="8" justifyContent="space-between">
          <Summary status={status} />
          <Button appearance="subtle" disabled={busy} onClick={onRefresh} size="sm">
            Refresh
          </Button>
        </Group>
      )}
      {status.languages === 'item' && (
        <Alert intent="warning">
          <Text fontSize="sm">
            The site&apos;s languages couldn&apos;t be read, so only the languages this item is already in are listed. Refresh to try again.
          </Text>
        </Alert>
      )}
      {status.source.compared === null && (
        <Alert intent="warning">
          <Text fontSize="sm">There is no {source} version to compare with.</Text>
        </Alert>
      )}
      {empty.length > 0 && (
        <Alert intent="warning">
          <Group flexDirection="column" gap="4">
            <Text fontSize="sm">
              The {source} version itself has {count(empty.length, 'empty translatable field')}, so there is nothing to translate there:
            </Text>
            <Text fontSize="xs">{empty.map(fieldName).join(', ')}</Text>
          </Group>
        </Alert>
      )}
      {status.locales.length === 0 && (
        <Text color="fg.secondary" fontSize="sm">
          {status.languages === 'site'
            ? `This site has only one language, ${source}, so there is nothing to translate.`
            : `This item is only in ${source} so far.`}
        </Text>
      )}
      {status.locales
        .filter((row) => row.state !== 'missing')
        .map((row) => (
          <Locale editing={row.locale === locale} key={row.locale} row={row} source={source} />
        ))}
      <NotTranslated locale={locale} rows={status.locales.filter((row) => row.state === 'missing')} total={status.locales[0]?.total ?? 0} />
      <HowItIsChecked source={source} />
    </Group>
  );
}

function TranslationStatus({context}: {context: ExtensionContext}) {
  const {content, ready} = useContent(context);
  const [loaded, setLoaded] = useState<{key: string; outcome: StatusOutcome} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const key = content?.key ?? null;

  const load = useCallback(
    async (itemKey: string) => {
      const id = ++requestId.current;
      setBusy(true);
      setError(null);
      try {
        const outcome = await call(context, 'translationStatus', {key: itemKey});
        if (id === requestId.current) setLoaded({key: itemKey, outcome});
      } catch (e) {
        if (id === requestId.current) setError(e);
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [context],
  );

  // Not keyed on the version or locale: a language's status doesn't change with the version
  // open. Refresh picks up what was published since.
  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  const refresh = useCallback(() => {
    if (key) void load(key);
  }, [key, load]);

  if (!ready) return <Frame busy />;
  if (!content) {
    return (
      <Frame>
        <Text color="fg.secondary">Open an item to see its translations.</Text>
      </Frame>
    );
  }

  // Between switching items and the new answer arriving, `loaded` still describes the
  // previous item; show nothing of it.
  const outcome = loaded?.key === content.key ? loaded.outcome : null;
  const status = outcome?.kind === 'status' ? outcome.status : null;

  return (
    <Frame busy={busy} error={error} heading={status?.displayName} onRetry={refresh} subtitle={status ? subtitle(status) : undefined}>
      <style>{STYLE}</style>
      {outcome?.kind === 'nothing' && (
        <Alert intent="information">
          <Text fontSize="sm">{outcome.reason}</Text>
        </Alert>
      )}
      {status && (
        <StatusBody busy={busy} locale={content.locale} onRefresh={refresh} status={status} />
      )}
    </Frame>
  );
}

register((context) => <TranslationStatus context={context} />);
