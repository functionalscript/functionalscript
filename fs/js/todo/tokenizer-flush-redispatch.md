## `js/tokenizer`: name the "flush token, re-dispatch input" step

**Priority:** P4
**Status:** open

### Problem

Whenever a state in `fs/js/tokenizer/module.f.ts` ends its current token on a
character that belongs to the *next* token, it performs the same two-step
dance: re-run the tokenizer on the same input from a fresh state, then prepend
the finished (or error) token to whatever that re-dispatch produced:

```ts
const next = tokenizeOp(input, { kind: 'initial' })
return [{ first: <token>, tail: next[0] }, next[1]]
```

This exact shape — differing only in the prepended token and (twice) in the
restart state — appears **11 times**:

| site | prepended token | restart state |
|---|---|---|
| `invalidNumberToToken` (`:559`) | `invalid number` error | `initial` |
| `terminalToToken`, both arms (`:635`) | `invalid number` error / the number token | `initial` |
| `bigintToToken` default arm (`:655`) | `invalid number` error | `initial` |
| `invalidNumberStateOp` handler (`:685`) | `invalid number` error | `initial` |
| `parseEscapeDefault` (`:702`) | `unescaped character` error | `string` (keeps `value`) |
| `parseUnicodeCharDefault` (`:721`) | `invalid hex value` error | `string` (keeps `value`) |
| `parseIdDefault` (`:750`) | keyword-or-id token | `initial` |
| `parseOperatorStateOp` default (`:764`) | the operator token | `initial` |
| `parseWhitespaceDefault` (`:807`) | `{ kind: 'ws' }` | `initial` |
| `parseNewLineDefault` (`:821`) | `{ kind: 'nl' }` | `initial` |

Each occurrence forces the reader to re-verify the same non-obvious invariant
(the current input byte is *not* consumed by the finished token; it is replayed
into the restart state, and the restart's own output ordering is preserved).
That invariant should be established once, in a named function, not re-proven
at every call site — the same "diff two near-identical blocks" readability cost
`AGENTS.md` calls out.

A second, smaller instance of the same disease: `tokenizeEofOp` (`:860-886`)
appends `{kind: 'eof'}` and returns `{ kind: 'eof' }` as the next state in
**every** arm of its 14-case switch. The per-state logic is only "which tokens
flush at EOF"; the eof-token/eof-state envelope is constant and could be
applied once around a switch that returns just the flushed `List<JsToken>`.

### Proposal

1. A module-scope helper naming the flush-and-replay step (it captures no
   local state, so it belongs at module scope per `AGENTS.md`):

   ```ts
   const flushThen = (token: JsToken) => (restart: TokenizerState) =>
       (input: number): readonly [List<JsToken>, TokenizerState] => {
           const [tokens, state] = tokenizeOp(input, restart)
           return [{ first: token, tail: tokens }, state]
       }

   const flush = (token: JsToken) => flushThen(token)({ kind: 'initial' })
   ```

   The 9 `initial`-restart sites become `flush(<token>)(input)`; the two
   string-restart sites become
   `flushThen({ kind: 'error', message: … })({ kind: 'string', value: state.value })(input)`.

2. Restructure `tokenizeEofOp` so the switch computes only the flushed tokens,
   and the `{kind:'eof'}` token + `{ kind: 'eof' }` state are appended once:

   ```ts
   const eofFlush = (state: TokenizerState): List<JsToken> => {
       switch (state.kind) {
           case 'initial': return []
           case 'id': return [idToToken(state.value)]
           /* … one line per state, no eof noise … */
       }
   }

   const tokenizeEofOp = (state: TokenizerState): readonly [List<JsToken>, TokenizerState] =>
       [flat([eofFlush(state), [{ kind: 'eof' }]]), { kind: 'eof' }]
   ```

   (The `'eof'` state itself flushes an `'eof'` error token — one special case
   the helper form keeps visible.)

Both changes are behavior-preserving; existing proofs must pass unchanged.

### Tasks

- [ ] Add `flushThen`/`flush`; rewrite the 11 flush-and-replay sites.
- [ ] Split `tokenizeEofOp` into `eofFlush` + a single eof envelope.
- [ ] `npx tsc` clean; `fjs t` passes with full existing coverage.

### Related

- [i667-js-tokenizer-handler-literals](667-js-tokenizer-handler-literals.md)
  — covers the *continuing-token* literal shapes in the number/escape handlers;
  this issue covers the *token-boundary* shape. Independent, compatible edits.
- [i666-js-tokenizer-position-layer](666-js-tokenizer-position-layer.md)
  — metadata layering, orthogonal.
