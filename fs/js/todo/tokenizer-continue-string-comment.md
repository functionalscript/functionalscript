## tokenizer-continue-string-comment. Name the string/comment accumulate-in-place emit shape

**Priority:** P4
**Status:** open

### Problem

The tokenizer has a named-factory story for continuing a *number* token
([667-js-tokenizer-handler-literals](./667-js-tokenizer-handler-literals.md))
and for the token-boundary *flush*
([tokenizer-flush-redispatch](./tokenizer-flush-redispatch.md)), but the
third continuing-emit shape — "append the input code point to the current
string/comment value and stay in the same accumulating state" — is
copy-pasted and unnamed in `fs/js/tokenizer/module.f.ts`:

```ts
// parseStringStateOp default (:703)
(state: ParseStringState) => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }]
// parseEscapeCharStateOp, the "/\/" self-insert row (:720) — byte-identical body
state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }]
// parseSinglelineCommentStateOp default (:791)
(state: ParseCommentState) => input => [empty, { ...state, value: appendChar(state.value)(input) }]
// parseMultilineCommentStateOp default (:797) — identical to :791
(state: ParseCommentState) => input => [empty, { ...state, value: appendChar(state.value)(input) }]
```

The emit shape `[empty, { …, value: appendChar(state.value)(input) }]` is
written four times (`:703` ≡ `:720` exactly; `:791` ≡ `:797` exactly).

### Proposal

Two module-scope helpers mirroring the `numberToken`/`escapeTo` factories
proposed in 667. Note the `:720` call site lives in a
`rangeSetFunc<ParseEscapeCharState>` row, so its callback receives
`{ kind: 'escapeChar', value: string }`, not `ParseStringState` — the helper
therefore takes only the shared shape it actually reads (`value`) and always
emits `kind: 'string'`, which is correct for both sites (the escape
self-insert returns to the string state):

```ts
const continueString = (state: { readonly value: string }) => (input: number): readonly[List<JsToken>, TokenizerState] =>
    [empty, { kind: 'string', value: appendChar(state.value)(input) }]

const continueComment = (state: ParseCommentState) => (input: number): readonly[List<JsToken>, TokenizerState] =>
    [empty, { ...state, value: appendChar(state.value)(input) }]
```

Route `:703` (`ParseStringState`) and `:720` (`ParseEscapeCharState`) through
`continueString`, and `:791`/`:797` through `continueComment`.

### Tasks

- [ ] Add the two helpers; replace the four inline copies.
- [ ] `npx tsc`, `fjs t`; tokenizer proofs pass unchanged.

### Related

- [667-js-tokenizer-handler-literals.md](./667-js-tokenizer-handler-literals.md)
  — number/escape continuation factories; explicitly leaves the self-insert
  rows alone, which this issue picks up.
- [tokenizer-flush-redispatch.md](./tokenizer-flush-redispatch.md) — the
  boundary-flush shape; orthogonal.
