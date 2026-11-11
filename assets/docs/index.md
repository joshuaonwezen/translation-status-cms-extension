# Translation status

## Setup
1. **CMS API client**: needed for the sidebar. Read access is enough.
2. **Optimizely Graph**: the site's single key. Needed for the Translations page. The sidebar works without it,
   but then lists only the languages an item is already in.

## Using it
Open an item and the **Translations** tab on the right-hand rail. The source is the language the item was
created in; each other language is compared with its published version, field by field. Only text fields set as
translatable on their content type count, including those of blocks added inline in Visual Builder. Shared blocks
are separate items with their own languages. Use **Refresh** after publishing a translation.

**Extensions > Translations** counts the published pages per language from Graph. A language that only has a
draft counts as missing there; the sidebar shows drafts too.

Variations are not compared: the CMS API returns a variation's blocks without their values.
