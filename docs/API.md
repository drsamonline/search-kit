# search-kit — API reference

**Version 1.0.0.** **Ranked search over big corpora.** Zero dependencies. One file. An inverted index with prefix and fuzzy matching — the shared logic extracted from the drsamonline apps that repeat it.

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="search-kit.js"></script>
Search.index(...)
// or: const Search = require('./search-kit.js')
```

## The surface (1 entries)

| Name | Arguments | What it does |
|---|---|---|
| `Search.index` | `(items, opts)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
