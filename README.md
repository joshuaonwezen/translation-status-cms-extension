# Translation status: CMS UI extension

An Optimizely CMS (SaaS) UI extension, built as a CMS-scoped OCP app. It shows where each language stands: field by field for the item open in the editor, and page by page across the instance.

## What it does

### Translations sidebar (per item)
- The item's name as the heading, and what it is compared with ("Compared with the published English version from 5 Nov").
- Every language of the site, from Graph's `Locales` enum (the same source as the site's `getSupportedLocales()`), named for the editor ("Dutch (nl)"), with a state:
  - published;
  - published with unpublished changes;
  - draft only;
  - not translated.
- Without a Graph key, or when Graph doesn't answer, only the languages the item is already in, with a notice saying why the untranslated ones are missing.
- The **source** is the language the item was created in (its primary locale). Each other language's newest version is compared with the source's **published** version (its newest draft if it was never published), field by field:
  - **empty:** the source has text, this language has none;
  - **same as the source:** word for word, so maybe untranslated, maybe a name that stays the same;
  - **source changed since:** last changed before the source's published version.
- The source's own empty translatable fields, which leave nothing to translate.
- **Refresh** after publishing a translation, **Retry** after an error, and a "How this is checked" section for the details below.

A field counts when its content type marks it `isLocalized` and it is a string or rich text. That includes the fields of inline blocks in a Visual Builder composition and inline blocks in content areas. Fields are matched by composition node id, falling back to position. Shared blocks are separate items with their own languages.

Each language's versions are read a page of 100 at a time until its published version turns up, for at most 10 pages (1,000 versions). A language published more than 1,000 versions ago shows as draft only.

### Translations view (instance-wide)
- Per language, how many pages are published in it, and how many of those are out of date against the source. The source here is the language most pages are published in.
- Every page with each language's state (published, out of date, missing), pages with gaps first. With "only gaps" on and none left: "Every page is in every language".
- Graph is read up to 3,000 published page languages; past that the view says its numbers are incomplete.

The view reads Graph with the single key, so it sees published versions only: a language that only has a draft counts as missing there. The sidebar reads the CMS REST API and shows drafts too.

## Platform constraints (CMS UI extensions beta, SDK 1.1.0)
- **The extension context is only `{key, version, locale, publicUrl}`.** The backend reads each language's versions itself.
- **Variations are not compared:** the CMS API returns a variation's blocks without their values. Base versions only.
- **Extensions get no CMS token.** The app stores a CMS API client in its settings.
- **Reading settings an install never saved throws** in the production runtime. `readSection` treats that as empty.
- **Locale spelling:** Graph's enum spells region locales `ja_JP`, while the CMS REST API and `_metadata.locale` use `ja-JP`. Everything here uses the hyphen.

## Settings
- **CMS API client:** needed for the sidebar. Read access is enough.
- **Optimizely Graph:** the instance's single key. Needed for the view. Optional for the sidebar, which uses it to list the languages an item isn't translated into yet.

Each action checks only the settings it uses (`requireCms`/`requireGraph` in `settings.ts`) and answers `412 not_configured` with a plain sentence when one is missing.

## Security and errors
- Every action's parameters go through one parser in `src/backend/lib/validate.ts` before any CMS or Graph call. The content key (dashes stripped, lower-cased) must be 32 hex characters, because it ends up in CMS URL paths. Unknown fields are dropped; an unknown action is echoed back cut to 64 characters.
- Upstream errors keep their HTTP status and body in the app log only. The UI maps every error code to a plain sentence (`src/cms-ui-extensions/common/api.ts`).

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
| `src/backend/functions/CmsUiExtension.ts` | Action router: `translationStatus` (`{key}`), `coverage` (`{}`); validates params, checks the settings each action needs |
| `src/backend/lib/validate.ts` | One parser per action |
| `src/backend/lib/errors.ts` | `ActionError` (400) and `NotConfiguredError` (412) |
| `src/backend/lib/fields.ts` | Localized fields of a version, and the comparison: pure |
| `src/backend/lib/translations.ts` | The two actions, version paging, and the coverage summary |
| `src/backend/lib/graph.ts`, `cms.ts` | Graph (languages, published pages) and CMS REST |
| `src/cms-ui-extensions/translations/` | `TranslationStatus.sidebar.tsx`, `TranslationCoverage.view.tsx`, the coverage bars, language names and dates (`format.ts`) |

## Deploy

```bash
ocp app register --appId cms_translation_status --name "Translation status" --product HUB --personal   # once
ocp app prepare --bump-dev-version --publish
ocp directory install cms_translation_status@<version> --scope <cms-instance-uuid>
```
