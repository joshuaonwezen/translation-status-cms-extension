// The localized text of one CMS REST version, field by field, so two language versions can be
// compared. "Localized" comes from the content type definitions (isLocalized), so the page's
// own fields and every inline block in its Visual Builder composition are covered without
// per-type code. Shared blocks are separate items with their own languages.

export type PropertyData = {value?: unknown} | null | undefined;
export type Properties = Record<string, PropertyData>;

export interface CompositionNode {
  id?: string;
  displayName?: string;
  nodeType?: string;
  component?: {contentType?: string; reference?: string; properties?: Properties} | null;
  nodes?: CompositionNode[] | null;
}

export interface VersionContent {
  contentType?: string;
  properties?: Properties | null;
  composition?: CompositionNode | null;
}

export interface TypeInfo {
  displayName?: string;
  baseType?: string;
  properties?: Record<string, {displayName?: string; type?: string; isLocalized?: boolean} | undefined>;
}

export type TypeLookup = (contentType: string | undefined) => TypeInfo | undefined;

export interface LocalizedField {
  /** Stable across languages: the composition node id plus the property name. */
  id: string;
  /** The same field by position, for when a language version's nodes got new ids. */
  position: string;
  label: string;
  /** The block it belongs to; '' for the item's own fields. */
  where: string;
  text: string;
}

const TEXT_TYPES = new Set(['string', 'richText']);

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonText(node: unknown): string {
  if (Array.isArray(node)) return node.map(jsonText).join(' ');
  if (!node || typeof node !== 'object') return '';
  const n = node as {text?: unknown; children?: unknown};
  return [typeof n.text === 'string' ? n.text : '', jsonText(n.children)].join(' ');
}

/** The visible text of a string or rich text value. */
export function textOf(value: unknown): string {
  if (typeof value === 'string') return /<[a-z][^>]*>/i.test(value) ? stripHtml(value) : value.trim();
  if (value && typeof value === 'object') {
    const v = value as {html?: unknown; json?: unknown};
    if (typeof v.html === 'string') return stripHtml(v.html);
    if (v.json) return jsonText(v.json).replace(/\s+/g, ' ').trim();
  }
  return '';
}

function fieldsOf(
  contentType: string | undefined,
  properties: Properties | null | undefined,
  idPrefix: string,
  positionPrefix: string,
  where: string,
  types: TypeLookup,
  out: LocalizedField[],
) {
  const info = types(contentType);
  for (const [name, prop] of Object.entries(info?.properties ?? {})) {
    if (!prop) continue;
    const value = properties?.[name]?.value;
    if (prop.isLocalized && TEXT_TYPES.has(prop.type ?? '')) {
      out.push({
        id: `${idPrefix}${name}`,
        position: `${positionPrefix}${name}`,
        label: prop.displayName || name,
        where,
        text: textOf(value),
      });
    }
    // Inline blocks in a content area, and type:"component" properties, carry their own fields.
    const inline = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
    inline.forEach((item, i) => {
      if (!item || typeof item !== 'object' || !('properties' in item)) return;
      const block = item as {contentType?: string; properties?: Properties};
      const label = types(block.contentType)?.displayName || block.contentType || name;
      fieldsOf(block.contentType ?? undefined, block.properties, `${idPrefix}${name}[${i}].`, `${positionPrefix}${name}[${i}].`, where ? `${where} > ${label}` : label, types, out);
    });
  }
}

/** Every localized text field of the version: the item's own, then each inline block's, in page order. */
export function localizedFields(version: VersionContent, types: TypeLookup): LocalizedField[] {
  const out: LocalizedField[] = [];
  fieldsOf(version.contentType, version.properties, 'page:', 'page:', '', types, out);
  const walk = (node: CompositionNode | null | undefined, position: string) => {
    if (!node) return;
    const c = node.component;
    if (c && !c.reference) {
      const where = node.displayName || types(c.contentType)?.displayName || c.contentType || 'Block';
      fieldsOf(c.contentType, c.properties, `${node.id ?? position}:`, `${position}:`, where, types, out);
    }
    (node.nodes ?? []).forEach((child, i) => walk(child, `${position}/${i}`));
  };
  walk(version.composition, 'c');
  return out;
}

export interface Comparison {
  /** Fields with text in the source and nothing here. */
  empty: LocalizedField[];
  /** Fields still word for word the source: maybe untranslated, maybe a name that stays the same. */
  same: LocalizedField[];
  translated: number;
  /** Source fields with text. */
  total: number;
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function compareFields(source: LocalizedField[], target: LocalizedField[]): Comparison {
  const byId = new Map(target.map((f) => [f.id, f]));
  const byPosition = new Map(target.map((f) => [f.position, f]));
  const result: Comparison = {empty: [], same: [], translated: 0, total: 0};
  for (const field of source) {
    if (!field.text) continue;
    result.total++;
    const text = (byId.get(field.id) ?? byPosition.get(field.position))?.text ?? '';
    if (!text) result.empty.push(field);
    else if (normalize(text) === normalize(field.text) && field.text.length > 3 && /\p{L}/u.test(field.text)) result.same.push(field);
    else result.translated++;
  }
  return result;
}

/** Every content type named anywhere in the version, so their definitions can be fetched first. */
export function contentTypesIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => contentTypesIn(v, found));
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'contentType' && typeof inner === 'string') found.add(inner);
      else contentTypesIn(inner, found);
    }
  }
  return found;
}
