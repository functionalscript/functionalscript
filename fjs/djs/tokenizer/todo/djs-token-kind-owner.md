## djs-token-kind-owner. `mapDjsToken` restates the whole `DjsToken` vocabulary, unguarded

**Priority:** P4
**Status:** open

### Problem

The 23-kind `DjsToken` vocabulary is enumerated three times in two modules:

- `fjs/djs/tokenizer/types.ts:27-39` — the `DjsToken` union itself;
- `fjs/djs/tokenizer/module.f.mjs:635-661` — `mapDjsToken`'s 23-label
  `switch (input.kind)` that narrows `JsToken` to `DjsToken`;
- `fjs/djs/parser/module.f.mjs:98-103` — `_tokenKindNames`, the same set
  minus `eof`.

The parser's copy is at least pinned to the type
(`Assert<Equal<(typeof _tokenKindNames)[number], Exclude<DjsToken['kind'], 'eof'>>>`
in its proof). `mapDjsToken`'s is linked to nothing, and its `default` arm
swallows a miss as `{ kind: 'error', message: 'invalid token' }` — a kind
added to `DjsToken` but forgotten here becomes a runtime invalid-token
error with no compile-time signal. The narrowing the switch performs is
exactly the membership test `_tokenKindNames` already encodes.

### Proposal

One exported `_djsTokenKinds` list beside the tokenizer, pinned to
`DjsToken['kind']` with the existing `Assert<Equal<...>>` pattern;
`mapDjsToken` becomes a membership test over it, and the parser's
`_tokenKindNames` derives as "`_djsTokenKinds` minus `'eof'`" instead of a
hand-written copy. The membership test needs the same care `isKeywordToken`
already takes about narrowing, but the error fallback stays: it is the
correct answer for a genuine non-DJS `JsToken`, just no longer for a
forgotten DJS one.

### Tasks

- [ ] Add the pinned list; rewrite `mapDjsToken`'s supported arm as
      membership; derive the parser's `_tokenKindNames`.
- [ ] `tsc`, `fjs t`.

### Related

- [../../todo/value-token-kind-list.md](../../todo/value-token-kind-list.md)
  — the parser-side subset of the same vocabulary, spelled four more times.
- [tokenize-string-derive.md](./tokenize-string-derive.md) — the pipeline
  duplication in this file; independent.
