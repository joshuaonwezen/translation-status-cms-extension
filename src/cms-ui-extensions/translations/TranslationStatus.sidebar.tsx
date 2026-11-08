import {Alert, Badge, Button, Group, Separator, Text} from '@optiaxiom/react';
import {register, type ExtensionContext} from '@optimizely/cms-extensibility-sdk';
import type {FieldRef, LocaleRow, LocaleState, StatusOutcome} from '@shared/types';
import {useCallback, useEffect, useRef, useState} from 'react';

import {call} from '../common/api';
import {Frame} from '../common/Frame';
import {useContent} from '../common/useContent';

const TITLE = 'Translations';

const STATE: Record<LocaleState, {label: string; intent: 'success' | 'warning' | 'neutral'}> = {
  published: {label: 'Published', intent: 'success'},
  changes: {label: 'Unpublished changes', intent: 'warning'},
  draft: {label: 'Draft only', intent: 'neutral'},
  missing: {label: 'Not translated', intent: 'neutral'},
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '');
const fieldName = (f: FieldRef) => (f.where ? `${f.where} > ${f.label}` : f.label);

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
  const [open, setOpen] = useState(false);
  const state = STATE[row.state];
  const details = row.empty.length + row.same.length;
  return (
    <Group flexDirection="column" gap="4">
      <Group alignItems="center" flexWrap="wrap" gap="8">
        <Text fontSize="sm" fontWeight="600">
          {row.locale}
        </Text>
        <Badge intent={state.intent} variant="subtle">
          {state.label}
        </Badge>
        {row.olderThanSource && (
          <Badge intent="warning" variant="subtle">
            Older than {source}
          </Badge>
        )}
        {editing && (
          <Text color="fg.tertiary" fontSize="xs">
            you are editing this one
          </Text>
        )}
      </Group>
      {row.state !== 'missing' ? (
        <Text color="fg.secondary" fontSize="xs">
          {row.translated} of {row.total} fields translated
          {row.empty.length ? ` · ${row.empty.length} empty` : ''}
          {row.same.length ? ` · ${row.same.length} same as ${source}` : ''} · version {row.version}, {date(row.lastModified)}
        </Text>
      ) : (
        <Text color="fg.secondary" fontSize="xs">
          No {row.locale} version yet: {row.total} fields to translate.
        </Text>
      )}
      {details > 0 && (
        <>
          <Button appearance="subtle" onClick={() => setOpen(!open)} size="sm">
            {open ? 'Hide fields' : 'Show fields'}
          </Button>
          {open && (
            <Group flexDirection="column" gap="8">
              <FieldList fields={row.empty} title="Empty" />
              <FieldList fields={row.same} title={`Same as ${source} (maybe untranslated, maybe a name)`} />
            </Group>
          )}
        </>
      )}
    </Group>
  );
}

function TranslationStatus({context}: {context: ExtensionContext}) {
  const content = useContent(context);
  const [outcome, setOutcome] = useState<StatusOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (key: string, locale: string) => {
      const id = ++requestId.current;
      setBusy(true);
      try {
        const next = await call(context, 'translationStatus', {key, locale});
        if (id !== requestId.current) return;
        setOutcome(next);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(e);
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [context],
  );

  // Not keyed on the version: a language's status doesn't change with the version open.
  useEffect(() => {
    if (content?.key) void load(content.key, content.locale);
    else setOutcome(null);
  }, [content?.key, content?.locale, load]);

  if (!content) return <Frame busy title={TITLE} />;
  const status = outcome?.kind === 'status' ? outcome.status : null;

  return (
    <Frame
      busy={busy}
      error={error}
      subtitle={
        status
          ? `${status.displayName}: each language compared with the published ${status.source.locale} version (${date(status.source.lastModified)}).`
          : undefined
      }
      title={TITLE}
    >
      {outcome?.kind === 'nothing' && (
        <Alert intent="information">
          <Text fontSize="sm">{outcome.reason}</Text>
        </Alert>
      )}
      {status && (
        <Group flexDirection="column" gap="12">
          {status.source.version === null && (
            <Alert intent="warning">
              <Text fontSize="sm">There is no {status.source.locale} version to compare with.</Text>
            </Alert>
          )}
          {status.source.empty.length > 0 && (
            <Alert intent="warning">
              <Group flexDirection="column" gap="4">
                <Text fontSize="sm">
                  The {status.source.locale} version itself has {status.source.empty.length} empty localized field
                  {status.source.empty.length > 1 ? 's' : ''}, so there is nothing to translate there:
                </Text>
                <Text fontSize="xs">{status.source.empty.map(fieldName).join(', ')}</Text>
              </Group>
            </Alert>
          )}
          {status.locales.map((row) => (
            <Group flexDirection="column" gap="8" key={row.locale}>
              <Separator />
              <Locale editing={row.locale === content.locale} row={row} source={status.source.locale} />
            </Group>
          ))}
          <Text color="fg.tertiary" fontSize="xs">
            Fields marked localized on their content type count, inline Visual Builder blocks included. Shared blocks have their
            own languages; variations aren&apos;t compared.
          </Text>
        </Group>
      )}
    </Frame>
  );
}

register((context) => <TranslationStatus context={context} />);
