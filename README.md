# search-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/search-kit/)
[![test](https://github.com/drsamonline/search-kit/actions/workflows/test.yml/badge.svg)](https://github.com/drsamonline/search-kit/actions/workflows/test.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

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

## Support

<img src="docs/assets/support-portrait.jpg" width="72" height="72" alt="Dr. Sohil Momin" align="left" style="border-radius:50%;margin-right:1rem">

Free, offline, accountless — and staying that way. If it earned its keep:

| | |
|---|---|
| UPI (India) | `drsohilboi@ybl` — payee Dr. Sohil Momin, open amount, or scan [the QR](docs/assets/upi-qr.svg) |
| GitHub Sponsors | [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) |
| Ko-fi | [ko-fi.com/matneo](https://ko-fi.com/matneo) |
| PayPal | [paypal.me/drsohilmomin](https://paypal.me/drsohilmomin?locale.x=en_GB&country.x=IN) |
| My books | [Amazon author store](https://www.amazon.com/stores/author/B08ZT331LY/allbooks?ccs_id=aed72b9f-71d9-41dc-adee-e9368a317acc) |
| More apps | [drsamonline.github.io](https://drsamonline.github.io/) |
| Email | [sohilmomin2000@gmail.com](mailto:sohilmomin2000@gmail.com) |

Nothing is gated behind it: no accounts, no tracking, no network requests.

## Licence

PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin. Part of the Forge system — kits open, orchestrator licensed.
