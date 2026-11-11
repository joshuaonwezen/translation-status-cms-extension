# Translation status

See where every language stands without leaving the CMS: field by field for the item open in the editor, and page by page across the site. Editors see which languages an item is in, which translatable fields are still empty or the same as the source, and which translations are older than the source.

Documentation: [walkthrough](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#translations).

## What editors get

### Translations sidebar (per item)
- The item's name as the heading, and what it is compared with ("Compared with the published English version from 5 Nov").
- Every language of the site, read from the `Locales` enum in Optimizely Graph and named for the editor ("Dutch (nl)"), with a state:
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
- **Refresh** after publishing a translation, **Retry** after an error, and a "How this is checked" section with the details below.

A field counts when its content type marks it as localized (`isLocalized`) and it is a string or rich text. That includes the fields of blocks added inline in a Visual Builder composition or a content area. Fields are matched by composition node ID, falling back to position. Shared blocks are separate items with their own languages.

### Translations view (whole site)
- Per language, how many pages are published in it, and how many of those are out of date against the source. The source here is the language most pages are published in.
- Every page with each language's state (published, out of date, missing), pages with gaps first. With "only gaps" on and none left: "Every page is in every language".

The view reads Graph with the single key, so it sees published versions only: a language that only has a draft counts as missing there. The sidebar reads the CMS REST API and shows drafts too.

## Setup

1. Install the app on the CMS instance (see [Deploy](#deploy)). Each CMS instance gets its own install.
2. Fill in the settings. It works with any Optimizely CMS (SaaS) instance.
3. Open an item and the **Translations** tab on the editor's right-hand rail. The view is under Extensions in the navigation rail.

| Setting | Required | Where to find it | Used for |
|---|---|---|---|
| CMS client ID and secret | For the sidebar | CMS: Settings > API Keys. Read access is enough. | Reading each language version of the open item, drafts included, and the content types that say which fields are translatable. |
| Optimizely Graph single key | For the view | CMS: Settings > API Keys | Counting the published pages per language. The sidebar uses it to list the languages an item isn't translated into yet, and works without it. |

Each action checks only the settings it uses and, when one is missing, answers with a plain sentence saying which.

Using the extension on another CMS instance: [reuse](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#reuse). Something not working: [troubleshooting](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#troubleshooting).

## What your site needs

Nothing. The extension reads only the CMS and Optimizely Graph, so it works the same whatever renders the site.

## Limits

These come from the CMS UI extensions platform (beta, SDK 1.1.0) and the CMS API:

- **The extension context is only `{key, version, locale, publicUrl}`.** The backend reads each language's versions itself.
- **Variations are not compared:** the CMS API returns a variation's blocks without their values. Base versions only.
- **Extensions get no CMS token.** The app stores its own CMS API client in its settings.
- **Version history is read up to 1,000 versions per language** (10 pages of 100). A language published more than 1,000 versions ago shows as draft only.
- **The view reads up to 3,000 published page languages.** Past that it says its numbers are incomplete.
- **Locale spelling:** Graph's enum spells region locales `ja_JP`, while the CMS REST API and `_metadata.locale` use `ja-JP`. The extension uses the hyphen throughout.
- **Reading settings an install never saved throws** in the production runtime; the app treats that as empty.

## Security

- The app only reads: nothing is written to the CMS or Graph.
- Every action's parameters go through one parser in `src/backend/lib/validate.ts` before any CMS or Graph call. The content key (dashes removed, lower-cased) must be 32 hex characters, because it ends up in CMS URL paths. Unknown fields are dropped; an unknown action is echoed back cut to 64 characters.
- Upstream errors keep their HTTP status and body in the app's logs only. Editors see a plain sentence for every error code (`src/cms-ui-extensions/common/api.ts`).
- Secrets (the CMS client secret and the Graph key) are stored in the app's secret settings fields and never sent to the browser.

## Develop

```bash
yarn install
yarn validate      # lint + typecheck + unit tests + build + ocp-app-sdk validate
ocp dev -p 3100    # the sidebar and view in a simulated CMS host
```

The live suite only reads:

```bash
TRANSLATIONS_LIVE=1 OPTIMIZELY_CMS_CLIENT_ID=<client-id> OPTIMIZELY_CMS_CLIENT_SECRET=<client-secret> \
OPTIMIZELY_GRAPH_SINGLE_KEY=<single-key> TRANSLATIONS_LIVE_KEY=<content-key> \
TRANSLATIONS_LIVE_OUT=/tmp/translations.json yarn vitest run tests/live
```

## Deploy

With the OCP CLI (run it as `npx -p @optimizely/ocp-cli-v2 ocp ...` if it isn't installed):

```bash
npx -p @optimizely/ocp-cli-v2 ocp app register      # once
ocp app prepare --bump-dev-version --publish
ocp directory install cms_translation_status@<version> --scope <cms-instance-uuid>
```

Publishing a new dev version moves existing installs onto it.

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
