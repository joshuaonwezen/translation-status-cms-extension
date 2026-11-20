# Translation status

See where every language stands without leaving the CMS: field by field for the item open in the editor, and page by page across the site. Editors see which languages an item is in, which translatable fields are still empty, the same as the source or changed in the source since, and which pages are drafts or out of date. It only reads.

Documentation: [walkthrough](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#translations).

## What editors get

### Translations sidebar (per item)
- The item's name as the heading, and its source: "Source: English, published 10 Sept".
- One chip per language of the site, then a card per language the item is in. Languages come from the CMS (`GET /v1/locales`, enabled ones, in the CMS's order) and carry the CMS's own names ("Deutsch", "français").
- Per language: its state (published, out of date, draft, not translated; a small pencil when a newer draft waits on a published version), a meter of translated fields, and the fields to check:
  - **empty:** the source has text, this language has none;
  - **same as the source:** word for word, so maybe untranslated, maybe a name that stays the same;
  - **changed in the source:** translated, but the source text changed after this language was last edited. Found by comparing the current source with the source version that was published when the translation was last changed.
- The languages the item isn't in yet share one card, which points to the CMS's own translate: **More > Translate**, with "Translate content using AI" ticked. That lives in the editor and has no API, so the panel can't start it.
- The source's own empty translatable fields, which leave nothing to translate; **Refresh**, **Retry** after an error, and a "How this works" section.

The **source** is the language the item was created in (its primary locale). Each other language's newest version is compared with the source's **published** version (its newest draft if it was never published). A field counts when its content type marks it as localized (`isLocalized`) and it is a string or rich text. That includes the fields of blocks added inline in a Visual Builder composition or a content area. Fields are matched by composition node ID, falling back to position. Shared blocks are separate items with their own languages.

### Translations view (whole site)
- Totals across every page and language: up to date, drafts, out of date, not started.
- A card per language with a stacked bar (up to date | draft | out of date, on a track of not started) and its counts. Clicking a card shows that language only.
- Every page with each language's state, searchable by name or URL, the most actionable first (out of date, then drafts, then not started), 50 at a time.

Published pages come from Graph (single key, so published versions only). Drafts come from the CMS (`GET /v1/content/versions?locales=…&statuses=draft,ready,inReview,scheduled`), so a language with only a draft shows as a draft, not as missing. Without the CMS client the view says so and counts drafts as not started.

## Setup

1. Install the app on the CMS instance (see [Deploy](#deploy)). Each CMS instance gets its own install.
2. Fill in the settings. It works with any Optimizely CMS (SaaS) instance.
3. Open an item and the **Translations** tab on the editor's right-hand rail. The view is under Extensions in the navigation rail.

| Setting | Required | Where to find it | Used for |
|---|---|---|---|
| CMS client ID and secret | For the sidebar | CMS: Settings > API Keys. Read access is enough. | Each language version of the open item (drafts included), the content types that say which fields are translatable, the site's languages, and drafts across the site for the view. |
| Optimizely Graph single key | For the view | CMS: Settings > API Keys | Counting the published pages per language. The site's languages come from it when there is no CMS client. |

Each action checks only the settings it uses and, when one is missing, answers with a plain sentence saying which.

Using the extension on another CMS instance: [reuse](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#reuse). Something not working: [troubleshooting](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#troubleshooting).

## What your site needs

Nothing. The extension only reads the CMS and Optimizely Graph, so it works the same whatever renders the site.

## Limits

These come from the CMS UI extensions platform (beta, SDK 1.1.0) and the CMS API:

- **The extension context is only `{key, version, locale, publicUrl}`.** The backend reads each language's versions itself.
- **Variations are not compared:** the CMS API returns a variation's blocks without their values. Base versions only.
- **Extensions get no CMS token.** The app stores its own CMS API client in its settings.
- **Version history is read up to 1,000 versions per language** (10 pages of 100). A language published more than 1,000 versions ago shows as draft only.
- **The view reads up to 3,000 published page languages.** Past that it says its numbers are incomplete.
- **Locale spelling:** Graph's enum spells region locales `ja_JP`, while the CMS REST API and `_metadata.locale` use `ja-JP`. The extension uses the hyphen throughout, and reads the languages from the CMS whenever it has the client.
- **Reading settings an install never saved throws** in the production runtime; the app treats that as empty.
- **Unpublished versions per language are read up to 2,000** (20 pages of 100) for the view.

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
| `src/backend/lib/fields.ts` | Localized fields of a version, and the comparisons: pure |
| `src/backend/lib/translations.ts` | Status per item, version paging, drafts across the site, and the coverage summary |
| `src/backend/lib/languages.ts` | The site's languages and their names |
| `src/backend/lib/graph.ts`, `cms.ts` | Graph (published pages) and CMS REST |
| `src/cms-ui-extensions/translations/` | `TranslationStatus.sidebar.tsx`, `TranslationCoverage.view.tsx`, the shared chips, bars and tokens (`ui.tsx`), dates and counts (`format.ts`) |
