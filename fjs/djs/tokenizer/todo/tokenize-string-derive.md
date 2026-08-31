## tokenize-string-derive. `tokenizeString` re-implements `tokenizeJs`; `toJsTokens` re-implements `toJsTokenWithMetadata`

**Priority:** P4
**Status:** open

### Problem

Two metadata-free copies of metadata-aware pipelines live in
`fjs/djs/tokenizer/module.f.mjs`:

1. `tokenizeString` (`:464-486`) vs `tokenizeJs` (`:501-531`): the same
   pipeline in the same order — empty-input short circuit →
   `descentParser(jsGrammar())` → `codePointsWithMetadata` → match →
   `getTokensFromAstRule` → the `'unterminated'`/`'numError'` structural-error
   probe → `filter(filterFunc)` + `concat(…)([''])` →
   `stateScan(scanFunc)(['', null, []])` → `flatMap(toJsToken*)` → append
   `eof`. The differences are only the error representation (`return 'error'`
   vs an error token with metadata) and the final `stringify`.

2. `toJsTokens` (`:410-418`) vs `toJsTokenWithMetadata` (`:422-431`) — the
   "a `/*` comment containing a newline also emits an `nl`" rule, twice:

   ```js
   if (token.kind === '/*') {
       const hasNl = token.value.includes('\n') || token.value.includes('\r')
       if (hasNl) return [token, { kind: 'nl' }]
   }
   ```

The module already contains the needed lifting idiom one screen lower, for
the DJS layer: `mapDjsTokenWithMetadata` (`:601-608`) derives the
metadata-aware scanner from the plain one by mapping metadata over the
produced tokens. The JS layer just doesn't use it.

There is also a separation-of-concerns problem: `tokenizeString` is
proof-only (`fjs/djs/tokenizer/proof.f.mjs` is its sole consumer) yet it
lives in the production module and pulls `stringifyAsTree`/`sort` from
`fjs/djs/serializer` into the tokenizer's import graph purely to format test
output. `fjs/js/tokenizer/proof.f.mjs:12` already shows the right shape for
its tokenizer: a proof-local stringifier over the production tokenizer.

### Proposal

- Keep `tokenizeJs` as the only pipeline. Derive the token-only view by
  projection: `tokenizeString` becomes (proof-local)
  `stringify(toArray(map(({ token }) => token)(tokenizeJs(cp)(''))))`, with
  the `'error'` result recovered from the single `{ kind: 'error' }` token.
- Derive `toJsTokenWithMetadata` from `toJsTokens` (or both from one
  `hasNlComment` helper), mirroring `mapDjsTokenWithMetadata`.
- Move `tokenizeString` (and the serializer imports it drags in) to
  `proof.f.mjs`.

### Tasks

- [ ] Unify the `/*`-with-newline rule; delete one of the twin functions.
- [ ] Rewrite `tokenizeString` as a projection of `tokenizeJs`; move it to
      the proof; drop the serializer imports from the tokenizer module.
- [ ] `tsc`, `fjs t` — the ~90 `tokenizeString` proof cases pass
      unchanged.

### Related

- `fjs/js/todo/666-js-tokenizer-position-layer.md` — the same
  "position/metadata as a separable layer" idea for the *other* tokenizer;
  this issue is the djs-side counterpart at the pipeline level.
