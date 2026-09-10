## value-token-kind-list. The value-carrying token kinds are spelled four times

**Priority:** P4
**Status:** open

### Problem

One fact — "these seven kinds are the token-shaped values" — lives in two
unlinked places across the parser:

- `fjs/djs/parser/grammar/module.f.mjs` — the `primitive` grammar variant
  (`null/true/false/undefined/number/string/bigint`, each as `sym(...)`);
- `fjs/djs/parser/module.f.mjs` — `primitiveOf`, a seven-arm `switch` over
  the variant's branch tags.

The switch is typed from the variant, so a branch removed from the grammar
is a `case` `tsc` rejects; a branch *added* is a case the switch lacks,
which `tsc` reports only as the function's end becoming reachable. Adding
a value kind means editing the variant and the switch, and forgetting the
switch is found at the type level only through that indirection. The
grammar already demonstrates the right pattern next door:
`_tokenKindNames` and `_framingKeywords` are single lists pinned to the
type level by `Assert<Equal<...>>` in its proof.

### Proposal

One list, the variant derived from it and the switch's exhaustiveness
asserted against it:

```js
export const _valueKinds = /** @type {const} */ ([
    'null', 'true', 'false', 'undefined', 'number', 'string', 'bigint',
])
```

- `primitive`: `fromEntries(_valueKinds.map(k => [k, sym(k)]))`, if the
  object-literal form isn't clearer kept as is with an `Assert` over its
  keys;
- `primitiveOf` keeps its switch — it is the one site with per-kind
  behavior — and its exhaustiveness is then checked against the one list,
  by an `Assert` in the proof rather than by reachability.

### Tasks

- [ ] Introduce the list; derive/pin the other three sites; add the proof
      `Assert`.
- [ ] `tsc`, `fjs t`.

### Related

- [../../tokenizer/todo/djs-token-kind-owner.md](../../tokenizer/todo/djs-token-kind-owner.md)
  — the same disease one layer down: the full `DjsToken` kind vocabulary
  restated in `mapDjsToken`.
