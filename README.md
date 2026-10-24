# search-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/search-kit/)
[![test](https://github.com/drsamonline/search-kit/actions/workflows/test.yml/badge.svg)](https://github.com/drsamonline/search-kit/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Ranked search over big corpora.** Zero dependencies. One file. An inverted index with prefix and fuzzy matching — the shared logic
extracted from the drsamonline apps that repeat it.

## Use it

See `search-kit.js` for the full API and `test-node.js` for worked examples.

## What it does

- Inverted index, built once
- exact + prefix matching
- fuzzy (edit-distance 1)
- multi-field, **tf-idf** ranked results (the ranking adopted from ml-kit)

## Verified

```
node test-node.js
12 passed, 0 failed
```

## Consumers

kent-repertory-explorer, boericke-repertory, remedy-relationship-explorer, open-materia-medica, SmartNotes, CLDR

## Licence

MIT. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
