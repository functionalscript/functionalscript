## tokenize-string-derive. `tokenizeString` is proof-only and lives in the production module

**Priority:** P4
**Status:** open

### Problem

`tokenizeString` in `fjs/djs/tokenizer/module.f.mjs` is a projection of
`tokenizeJs` — the tokens with their positions dropped, as one string, or
`error` where the stream holds an error token — and its sole consumer is
`fjs/djs/tokenizer/proof.f.mjs`. It still lives in the production module,
and pulls `stringifyAsTree` and `sort` from `fjs/djs/serializer` into the
tokenizer's import graph purely to format test output.
`fjs/js/tokenizer/proof.f.mjs` already shows the right shape for its
tokenizer: a proof-local stringifier over the production tokenizer.

The two duplications this issue used to name — a second copy of the
pipeline behind `tokenizeString`, and the `/*`-with-newline rule spelled
twice — went with the port to the LL(1) backend: there is one pipeline,
`tokenizeJs`, and the rule is stated once in its fold.

### Proposal

Move `tokenizeString` and the serializer imports it drags in to
`proof.f.mjs`; the ~90 proof cases that call it stay as they are.

### Tasks

- [ ] Move `tokenizeString` to the proof; drop the serializer imports from
      the tokenizer module.
- [ ] `tsc`, `fjs t` — the `tokenizeString` proof cases pass unchanged.

### Related

- `fjs/js/todo/666-js-tokenizer-position-layer.md` — the same
  "position/metadata as a separable layer" idea for the *other* tokenizer;
  this issue is the djs-side counterpart at the pipeline level.
