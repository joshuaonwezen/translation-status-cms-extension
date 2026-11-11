import {Alert, Badge, Button, Disclosure, DisclosureContent, DisclosureTrigger, Group, Separator, Text} from '@optiaxiom/react';
import {register, type ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import type {FieldRef, LanguageSource, LocaleRow, LocaleState, StatusOutcome, TranslationStatus as Status} from '@shared/types';
import {useCallback, useEffect, useRef, useState} from 'react';

import {call} from '../common/api';
import {Frame} from '../common/Frame';
import {useContent} from '../common/useContent';
import {languageLabel, languageName, shortDate} from './format';

const STATE: Record<LocaleState, {label: string; intent: 'success' | 'warning' | 'neutral'}> = {
  published: {label: 'Published', intent: 'success'},
  changes: {label: 'Unpublished changes', intent: 'warning'},
  draft: {label: 'Draft only', intent: 'neutral'},
  missing: {label: 'Not translated', intent: 'neutral'},
};

const LANGUAGE_NOTICE: Record<Exclude<LanguageSource, 'site'>, string> = {
  no_graph_key:
    "Only the languages this item is already in are listed. Languages it isn't translated into yet show up once a CMS admin adds the Optimizely Graph key on this app's settings page.",
  graph_failed:
    "The site's languages couldn't be read from Optimizely Graph, so only the languages this item is already in are listed. Refresh to try again.",
};

const fieldName = (f: FieldRef) => (f.where ? `${f.where} > ${f.label}` : f.label);
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function subtitle(status: Status): string | undefined {
  const name = languageName(status.source.locale);
  const when = status.source.lastModified ? ` from ${shortDate(status.source.lastModified)}` : '';
  if (status.source.compared === 'published') return `Compared with the published ${name} version${when}`;
  if (status.source.compared === 'draft') return `Compared with the ${name} draft${when}, which isn't published yet`;
  return undefined;
}

function FieldList({title, fields}: {title: string; fields: FieldRef[]}) {
  if (fields.length === 0) return null;
  return (
    <Group flexDirection="column" gap="2">
      <Text color="fg.secondary" fontSize="xs" fontWeight="600">
        {title}
      </Text>
      {fields.map((f, i) => (
        <Text fontSize="xs" key={`${fieldName(f)}-${i}`}>
          {fieldName(f)}
        </Text>
      ))}
    </Group>
  );
}

function Locale({row, source, editing}: {row: LocaleRow; source: string; editing: boolean}) {
  const state = STATE[row.state];
  const sourceName = languageName(source);
  const details = row.empty.length + row.same.length;
  return (
    <Group flexDirection="column" gap="4">
      <Group alignItems="center" flexWrap="wrap" gap="8">
        <Text fontSize="sm" fontWeight="600">
          {languageLabel(row.locale)}
        </Text>
        <Badge intent={state.intent} variant="subtle">
          {state.label}
        </Badge>
        {row.olderThanSource && (
          <Badge intent="warning" variant="subtle">
            {sourceName} changed since
          </Badge>
        )}
        {editing && (
          <Text color="fg.tertiary" fontSize="xs">
            you are editing this one
          </Text>
        )}
      </Group>
      {row.state === 'missing' ? (
        <Text color="fg.secondary" fontSize="xs">
          No {languageName(row.locale)} version yet: {count(row.total, 'field')} to translate.
        </Text>
      ) : (
        <Text color="fg.secondary" fontSize="xs">
          {row.translated} of {count(row.total, 'translatable field')} translated
          {row.empty.length ? ` · ${row.empty.length} empty` : ''}
          {row.same.length ? ` · ${row.same.length} same as ${sourceName}` : ''}
          {row.lastModified ? ` · last changed ${shortDate(row.lastModified)}` : ''}
        </Text>
      )}
      {details > 0 && (
        <Disclosure>
          <DisclosureTrigger>Show {count(details, 'field')}</DisclosureTrigger>
          <DisclosureContent>
            <Group flexDirection="column" gap="8">
              <FieldList fields={row.empty} title="Empty" />
              <FieldList fields={row.same} title={`Same as ${sourceName}`} />
            </Group>
          </DisclosureContent>
        </Disclosure>
      )}
    </Group>
  );
}

function HowItIsChecked({source}: {source: string}) {
  const name = languageName(source);
  return (
    <Disclosure>
      <DisclosureTrigger>How this is checked</DisclosureTrigger>
      <DisclosureContent>
        <Group flexDirection="column" gap="8">
          <Text color="fg.secondary" fontSize="xs">
            Each language&apos;s newest version is compared with the {name} version (the published one, when there is
            one), field by field. Only text
            fields set as translatable on their content type count, including those of blocks added inline in Visual
            Builder. Shared blocks are separate items with their own translations, and variations aren&apos;t compared.
          </Text>
          <Text color="fg.secondary" fontSize="xs">
            Same as {name}: word for word the {name} text. It may still need translating, or be a name that stays the same.
          </Text>
          <Text color="fg.secondary" fontSize="xs">
            {name} changed since: the {name} version was published after this language was last changed.
          </Text>
        </Group>
      </DisclosureContent>
    </Disclosure>
  );
}

function StatusBody({status, locale, busy, onRefresh}: {status: Status; locale: string; busy: boolean; onRefresh: () => void}) {
  const source = status.source.locale;
  const empty = status.source.empty;
  return (
    <Group flexDirection="column" gap="12">
      <Group justifyContent="end">
        <Button appearance="subtle" disabled={busy} onClick={onRefresh} size="sm">
          Refresh
        </Button>
      </Group>
      {status.languages !== 'site' && (
        <Alert intent={status.languages === 'graph_failed' ? 'warning' : 'information'}>
          <Text fontSize="sm">{LANGUAGE_NOTICE[status.languages]}</Text>
        </Alert>
      )}
      {status.source.compared === null && (
        <Alert intent="warning">
          <Text fontSize="sm">There is no {languageName(source)} version to compare with.</Text>
        </Alert>
      )}
      {empty.length > 0 && (
        <Alert intent="warning">
          <Group flexDirection="column" gap="4">
            <Text fontSize="sm">
              The {languageName(source)} version itself has {count(empty.length, 'empty translatable field')}, so there is
              nothing to translate there:
            </Text>
            <Text fontSize="xs">{empty.map(fieldName).join(', ')}</Text>
          </Group>
        </Alert>
      )}
      {status.locales.length === 0 && (
        <Text color="fg.secondary" fontSize="sm">
          {status.languages === 'site'
            ? `This site has only one language, ${languageLabel(source)}, so there is nothing to translate.`
            : `This item is only in ${languageLabel(source)} so far.`}
        </Text>
      )}
      {status.locales.map((row) => (
        <Group flexDirection="column" gap="8" key={row.locale}>
          <Separator />
          <Locale editing={row.locale === locale} row={row} source={source} />
        </Group>
      ))}
      <Separator />
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
    <Frame
      busy={busy}
      error={error}
      heading={status?.displayName}
      onRetry={refresh}
      subtitle={status ? subtitle(status) : undefined}
    >
      {outcome?.kind === 'nothing' && (
        <Alert intent="information">
          <Text fontSize="sm">{outcome.reason}</Text>
        </Alert>
      )}
      {status && <StatusBody busy={busy} locale={content.locale} onRefresh={refresh} status={status} />}
    </Frame>
  );
}

register((context) => <TranslationStatus context={context} />);
