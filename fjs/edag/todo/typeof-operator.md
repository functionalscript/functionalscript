## `typeof` has no EDAG node — and isn't in the operators spec at all yet

**Priority:** P2
**Status:** open

### Problem

`nanvm-lib`'s `typeof` (`Any::typeof_`, added in
functionalscript/functionalscript#1868) has no EDAG counterpart, for a more
basic reason than `?:`'s
([`ternary-conditional-node.md`](./ternary-conditional-node.md)): unlike
`?:`, `typeof` doesn't appear anywhere in
[`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)'s
operator table at all — not even as `not allowed`, the way `==`/`!=` are
listed and explicitly rejected there.
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)'s own
EDAG-level "Symbols" operator table doesn't list it either. So this isn't
only a missing EDAG node the way `?:`'s is (design decided, not yet
implemented) — the language-level decision to admit `typeof` as FJS syntax
at all hasn't been made or recorded anywhere.

The shared operator corpus works around the absence the same way
[`ternary-conditional-node.md`](./ternary-conditional-node.md) describes for
`?:`: [`fjs/nanvm/types.ts`](../../nanvm/types.ts)'s `NonEdagGroup` has a
`'typeof'` arm ([`fjs/nanvm/module.f.mjs`](../../nanvm/module.f.mjs)'s
`typeofCases`), whose cases always take the corpus's escape path rather than
lowering to a real expression.

### Proposal

- Decide, in
  [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md),
  whether `typeof` is admitted as FJS syntax at all — and if so, at what
  priority and with what return shape. `nanvm-lib`'s implementation returns
  an `Any<A>` string tag (`"undefined" | "object" | "boolean" | "number" |
  "bigint" | "string" | "function"`); a `"symbol"` tag never arises, since
  `Any<A>` has no `Symbol` variant. This is a language-design question
  outside `nanvm-lib`/`fjs/edag`'s own boundary — not something to answer
  implicitly by adding the node without the spec entry.
- **If admitted:** add `'typeof'` to
  [`fjs/edag/types.ts`](../types.ts)'s `Op1Id` (unary and eager — unlike
  `?:`, `typeof` needs no laziness machinery, since every operand it can be
  applied to is already a plain value) and its rtti schema in
  [`module.f.mjs`](../module.f.mjs). Move
  [`fjs/nanvm/module.f.mjs`](../../nanvm/module.f.mjs)'s `typeofCases` group
  off `NonEdagGroup` onto a real `Group1` with `op: 'typeof'`, retiring the
  `'typeof'` `NonEdagGroup` arm.
- **If not admitted** (the operators table's silence turns out to be
  deliberate, the same way `==`/`!=`'s explicit `not allowed` is):
  `nanvm-lib`'s `Any::typeof_` stays valid regardless — it is `nanvm-lib`'s
  own operator API, useful to a Rust caller or a future interpreter/runtime
  layer independent of what FJS source syntax can spell — but the
  `NonEdagGroup` `'typeof'` arm and its corpus cases should say so
  explicitly, in a doc comment, rather than reading as "not implemented yet."

### Tasks

- [ ] Decide, and record in `spec/todo/2340-operators.md`, whether `typeof`
      is FJS syntax.
- [ ] If yes: add `'typeof'` to `fjs/edag/types.ts`'s `Op1Id` and
      `fjs/edag/module.f.mjs`'s schema; move `fjs/nanvm/module.f.mjs`'s
      `typeofCases` group onto a real `op: 'typeof'` `Group1`; retire the
      `NonEdagGroup` `'typeof'` arm.
- [ ] If no: document, at the `NonEdagGroup` `'typeof'` arm and in
      `nanvm-lib/README.md`'s operator table, that this is permanent rather
      than pending.
- [ ] `tsc`, `fjs test`, `npm run gen`, `cargo test`,
      `cargo clippy --lib -- -D warnings`, `cargo fmt -- --check` (whichever
      path is taken).

### Related

- [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md) —
  the operator allowlist `typeof` is currently absent from.
- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md) —
  the EDAG's own Symbols/operator table, same absence.
- [`ternary-conditional-node.md`](./ternary-conditional-node.md) — the same
  `NonEdagGroup`-escape situation for `?:`, but with a design already
  decided.
- functionalscript/functionalscript#1868 — where `Any::typeof_` and the
  `NonEdagGroup` `'typeof'` arm landed.
