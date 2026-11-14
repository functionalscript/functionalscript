# URI component encoding as an FJS library function

**Status:** wip

JSON Schema's local references call the unsupported global
`encodeURIComponent`. Implement its encoding in `fjs/text/percent`, reusing
the existing UTF-8 and percent-encoding helpers. Keep JavaScript's unescaped
characters and string conversion, and fail on unpaired UTF-16 surrogates.
Use the library function in JSON Schema. The task owner explicitly excludes
common runtime admission from this change.

## Tasks

- Add and prove the library function against JavaScript's encoding behavior.
- Import it in JSON Schema and verify reference escaping.
- Promote JSON Schema to `.f.js` if the complete linked module compiles.
- Run scoped proofs, coverage, type checking and the authored `.f.js` checks.
