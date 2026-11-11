# Translation status

See which languages an item is in, which translatable fields are still untranslated, and how far each language
covers the site. Walkthrough: [Translation status extension](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#translations).

## Setup

Install the app on the CMS instance, then fill in the settings. It works with any Optimizely CMS (SaaS) instance.

1. **CMS API client**: a client ID and secret (CMS: Settings > API Keys). Needed for the sidebar. Read access is
   enough.
2. **Optimizely Graph**: the single key (CMS: Settings > API Keys). Needed for the Translations view. The sidebar
   works without it, but then lists only the languages an item is already in.

## Using it

Open an item and the **Translations** tab on the right-hand rail. The source is the language the item was
created in; each other language is compared with its published version, field by field. Only text fields set as
translatable on their content type count, including those of blocks added inline in Visual Builder. Shared blocks
are separate items with their own languages. Use **Refresh** after publishing a translation.

**Extensions > Translations** counts the published pages per language from Graph. A language that only has a
draft counts as missing there; the sidebar shows drafts too.

Variations are not compared: the CMS API returns a variation's blocks without their values.

## What your site needs

Nothing. The app reads only the CMS and Optimizely Graph.

## Help

- Using the app on another CMS instance: [reuse](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#reuse).
- Something not working: [troubleshooting](https://opti.joshuaonwezen.dev/demo/cms-ui-extensions#troubleshooting).
