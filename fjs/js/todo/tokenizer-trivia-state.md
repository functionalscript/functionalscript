## tokenizer-trivia-state. The whitespace and newline states are one state with two names

**Priority:** P4
**Status:** open

### Problem

`fjs/js/tokenizer/module.f.mjs` builds two trivia states whose dispatch
tables are byte-identical (`:630-633` and `:642-645`):

```js
const parseWhitespaceStateOp = create(parseWhitespaceDefault)([
    rangeSetFunc(rangeSetWhiteSpace)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'ws')]]),
    rangeSetFunc(rangeSetNewLine)(({ kind }) => () => [empty, triviaState[mergeTrivia(kind, 'nl')]])
])
// parseNewLineStateOp — the same two rows again
```

The defaults (`:624-627`, `:636-639`) differ only in the token they emit —
`{ kind: 'ws' }` vs `{ kind: 'nl' }` — and that token *is* the state:
`types.ts` gives `_ParseWhitespaceState = { kind: 'ws' }` and
`_ParseNewLineState = { kind: 'nl' }`, i.e. both are `{ kind: TriviaKind }`.
One state machine is written twice because the state type was split into two
singletons; `create(...)` also builds and merges two identical range maps at
module load, and the top-level dispatch (`'ws'`/`'nl'` cases) and
`tokenizeEofOp` carry the split too.

### Proposal

One `_ParseTriviaState = { kind: TriviaKind }` and one

```js
const parseTriviaStateOp = create(
    ({ kind }) => input => {
        const next = tokenizeCharCodeOp(input, { kind: 'initial' })
        return [{ first: { kind }, tail: next[0] }, next[1]]
    })([/* the two rows, once */])
```

with `case 'ws': case 'nl': return parseTriviaStateOp(state)(input)` at the
dispatch and the same collapse in `tokenizeEofOp`'s trivia arms. Removes the
duplicated table, one range-map build, and one of the two state typedefs.

### Tasks

- [ ] Merge the two states and their default handlers; collapse the
      dispatch and EOF arms.
- [ ] `tsc`, `fjs t`; the tokenizer proofs pin ws/nl merging behavior.

### Related

- [tokenizer-flush-redispatch.md](./tokenizer-flush-redispatch.md) — lists
  `parseWhitespaceDefault`/`parseNewLineDefault` as two rows of its flush
  table; merging them first shrinks that issue's table by one row.
- [666-js-tokenizer-position-layer.md](./666-js-tokenizer-position-layer.md)
  — same file, independent change.
