## tokenizer-finish-number-shared. One resolver for "is this number token complete?"

**Priority:** P4
**Status:** open

### Problem

The classification "these `numberKind`s (`'.'`, `'e'`, `'e+'`, `'e-'`) are an
*incomplete* number → emit an `invalid number` error; everything else is a
*complete* number → emit `bufferToNumberToken(state)`" is implemented twice
in `fjs/js/tokenizer/module.f.ts` with the same two outcomes:

```ts
// terminalToToken (:636-654)
switch (state.numberKind) {
    case '.': case 'e': case 'e+': case 'e-': {
        const next = tokenizeOp(input, { kind: 'initial' })
        return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
    }
    default: {
        const next = tokenizeOp(input, { kind: 'initial' })
        return [{ first: bufferToNumberToken(state), tail: next[0] }, next[1]]
    }
}

// tokenizeEofOp, number case (:878-885)
case 'number':
    switch (state.numberKind) {
        case '.': case 'e': case 'e+': case 'e-':
            return [[{ kind: 'error', message: 'invalid number' }, {kind: 'eof'}], { kind: 'eof' }]
    }
    return [[bufferToNumberToken(state), {kind: 'eof'}], { kind: 'eof' }]
```

The four-kind "incomplete" set and the error-vs-`bufferToNumberToken`
decision are duplicated; dropping a kind from one list silently changes only
one of the boundary/EOF paths. (`terminalToToken`'s two arms also repeat the
redispatch envelope, but that envelope is
[tokenizer-flush-redispatch](./tokenizer-flush-redispatch.md)'s territory.)

### Proposal

A single module-scope resolver used by both sites:

```ts
/** The token a buffered number state flushes to: an error while the number is
 * still incomplete (trailing `.`/`e`/`e+`/`e-`), the number token otherwise. */
const finishNumberToken = (state: ParseNumberState): JsToken => {
    switch (state.numberKind) {
        case '.': case 'e': case 'e+': case 'e-':
            return { kind: 'error', message: 'invalid number' }
        default:
            return bufferToNumberToken(state)
    }
}
```

`terminalToToken` collapses to one arm
(`[{ first: finishNumberToken(state), tail: next[0] }, next[1]]`) and
`tokenizeEofOp`'s number case to
`[[finishNumberToken(state), {kind: 'eof'}], { kind: 'eof' }]`. Composes
cleanly with `flushThen`/`eofFlush` from tokenizer-flush-redispatch: that
issue owns the *envelope*, this one the *which-token* decision inside it.

### Tasks

- [ ] Add `finishNumberToken`; rewrite both sites through it.
- [ ] `npx tsc`, `fjs t`; tokenizer proofs pass unchanged.

### Related

- [tokenizer-flush-redispatch.md](./tokenizer-flush-redispatch.md) — the
  flush/redispatch envelope around this decision; independent, combine freely.
- [667-js-tokenizer-handler-literals.md](./667-js-tokenizer-handler-literals.md)
  — restructures the digit *handlers*, not the finish/EOF decision.
