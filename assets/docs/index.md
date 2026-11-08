# Translation status

## Setup
1. **Optimizely Graph**: the instance's single key.
2. **CMS API client**: read access is enough.

## Using it
Open an item and the **Translations** tab on the right-hand rail. The source is the language the item was
created in; each other language is compared with its published version, field by field. Only fields whose
content type marks them as localized count, including those of inline Visual Builder blocks. Shared blocks are
separate items with their own languages.

**Extensions > Translations** counts the published pages per language from Graph. A language that only has a
draft counts as missing there; the sidebar shows drafts too.

Variations are not compared: the CMS API returns a variation's blocks without their values.
