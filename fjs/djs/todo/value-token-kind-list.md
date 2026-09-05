## value-token-kind-list. The value-carrying token kinds are spelled four times

**Priority:** P4
**Status:** open

### Problem

One fact — "these seven kinds are the token-shaped values" — lives in four
unlinked places across the parser:

- `fjs/djs/parser/module.f.mjs:237-246` — the `primitive` grammar variant
  (`null/true/false/undefined/number/string/bigint`, each as `sym(...)`);
- `fjs/djs/parser/module.f.mjs:371-381` — `tokenToValue`, a seven-arm
  `switch (token.kind)` over the same kinds;
- `fjs/djs/parser/module.f.mjs:385-397` — `isValueToken`, the same seven
  `case` labels again as a type guard;
- `fjs/djs/parser/types.ts:62-65` — `_ValueToken`, the same seven names a
  fourth time as a string-literal union.

Adding a value kind (as the bigint/RTTI serialization work would) means
editing a grammar variant, a switch, a guard, and a type. Missing the
grammar silently makes the value unparseable; missing `isValueToken`
silently routes the token to the identifier arm's "a reference carried no
name" refusal. The module already demonstrates the right pattern next door:
`_tokenKindNames` and `_framingKeywords` are single lists pinned to the
type level by `Assert<Equal<...>>` in `proof.f.mjs`.

### Proposal

One list, everything else derived or pinned:

```js
export const _valueKinds = /** @type {const} */ ([
    'null', 'true', 'false', 'undefined', 'number', 'string', 'bigint',
])
```

- `types.ts`: `_ValueToken = Extract<DjsToken, { kind: (typeof _valueKinds)[number] }>`
  (or an `Assert<Equal<...>>` in the proof, matching `_tokenKindNames`);
- `isValueToken`: membership in the list;
- `primitive`: `fromEntries(_valueKinds.map(k => [k, sym(k)]))`, if the
  object-literal form isn't clearer kept as is with an `Assert` over its
  keys;
- `tokenToValue` keeps its switch — it is the one site with per-kind
  behavior — and its exhaustiveness is then checked against the one list.

### Tasks

- [ ] Introduce the list; derive/pin the other three sites; add the proof
      `Assert`.
- [ ] `tsc`, `fjs t`.

### Related

- [../tokenizer/todo/djs-token-kind-owner.md](../tokenizer/todo/djs-token-kind-owner.md)
  — the same disease one layer down: the full `DjsToken` kind vocabulary
  restated in `mapDjsToken`.
