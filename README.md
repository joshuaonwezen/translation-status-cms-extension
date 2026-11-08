# Translation status: CMS UI extension

An Optimizely CMS (SaaS) UI extension, built as a CMS-scoped OCP app. It shows where each language stands: field by field for the item open in the editor, and page by page across the instance.

## What it does

### Translations sidebar (per item)
- Every language of the instance, from Graph's `Locales` enum (the same source as the site's `getSupportedLocales()`), with a state:
  - published;
  - published with unpublished changes;
  - draft only;
  - not translated.
- The **source** is the language the item was created in (its primary locale). Each other language's newest version is compared with the source's **published** version, field by field:
  - **empty:** the source has text, this language has none;
  - **same as the source:** word for word, so maybe untranslated, maybe a name that stays the same;
  - **older than the source:** last changed before the source's published version.
- The source's own empty localized fields, which leave nothing to translate.

A field counts when its content type marks it `isLocalized` and it is a string or rich text. That includes the fields of inline blocks in a Visual Builder composition and inline blocks in content areas. Fields are matched by composition node id, falling back to position. Shared blocks are separate items with their own languages.

### Translations view (instance-wide)
- Per language, how many pages are published in it, and how many of those are older than the source. The source here is the language most pages are published in.
- Every page with each language's state, pages with gaps first.

The view reads Graph with the single key, so it sees published versions only: a language that only has a draft counts as missing there. The sidebar reads the CMS REST API and shows drafts too.

## Platform constraints (CMS UI extensions beta, SDK 1.1.0)
- **The extension context is only `{key, version, locale, publicUrl}`.** The backend reads each language's versions itself.
- **Variations are not compared:** the CMS API returns a variation's blocks without their values. Base versions only.
- **Extensions get no CMS token.** The app stores a CMS API client in its settings.
- **Reading settings an install never saved throws** in the production runtime. `readSection` treats that as empty.
- **Locale spelling:** Graph's enum spells region locales `ja_JP`, while the CMS REST API and `_metadata.locale` use `ja-JP`. Everything here uses the hyphen.

## Settings
- **Optimizely Graph:** the instance's single key.
- **CMS API client:** read access is enough.

## Develop

```bash
yarn install
yarn validate      # lint + typecheck + unit tests + build + ocp-app-sdk validate
ocp dev -p 3100    # the sidebar and view in a simulated CMS host
```

The live suite only reads:

```bash
TRANSLATIONS_LIVE=1 OPTIMIZELY_CMS_CLIENT_ID=… OPTIMIZELY_CMS_CLIENT_SECRET=… OPTIMIZELY_GRAPH_SINGLE_KEY=… \
TRANSLATIONS_LIVE_KEY=<content key> TRANSLATIONS_LIVE_OUT=/tmp/translations.json yarn vitest run tests/live
```

## Layout

| Path | What |
|---|---|
| `src/backend/functions/CmsUiExtension.ts` | Action router: `translationStatus`, `coverage` |
| `src/backend/lib/fields.ts` | Localized fields of a version, and the comparison: pure |
| `src/backend/lib/translations.ts` | The two actions, and the coverage summary |
| `src/backend/lib/graph.ts`, `cms.ts` | Graph (languages, published pages) and CMS REST |
| `src/cms-ui-extensions/translations/` | `TranslationStatus.sidebar.tsx`, `TranslationCoverage.view.tsx`, the coverage bars |

## Deploy

```bash
ocp app register --appId cms_translation_status --name "Translation status" --product HUB --personal   # once
ocp app prepare --bump-dev-version --publish
ocp directory install cms_translation_status@<version> --scope <cms-instance-uuid>
```
