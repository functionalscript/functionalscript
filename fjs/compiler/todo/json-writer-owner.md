## json-writer-owner. `fjs compile` carries a JSON writer and an error renderer of its own

**Priority:** P4
**Status:** open

### Problem

[`fjs/compiler/module.f.mjs`](../module.f.mjs) says it is one thing — pick a
writer by the output's extension, run it, report — and holds three:

**A JSON writer.** `noJson`, `jsonLeaf`, `jsonMember`, `walked`,
`jsonValue`, `_tryJson` and `jsonText` are a complete fallible serializer
over the DataJS value model, built from `fjs/media/json/serializer`'s atoms
(`stringSerialize`, `boolSerialize`, `nullSerialize`, `colon`, `arrayWrap`,
`objectWrap`) with its own container recursion:

```js
// jsonValue
return value instanceof Array
    ? mapOk(arrayWrap)(walked(jsonValue)(value))
    : mapOk(objectWrap)(walked(jsonMember)(entries(value)))
```

`walked` stops at the first refused item. That is a requirement, not a
detail: a node reached many times is written once per reference, so a
refused leaf under one must be found along the first reference, or a module
of forty doublings over `[undefined]` walks two to the fortieth references
before it is refused. `jsonRefusals.firstRefusal` in
[`../proof.f.mjs`](../proof.f.mjs) pins it.

The one fact that is the compiler's here is the refusal list — a
non-finite number, a `bigint`, `undefined` — and none of it is the
compiler's: it is a property of two media types, JSON's leaf set against
DataJS's. Its sibling from the caller's side is already one line:
`dataJsText` is `tryStringify(value)` from `fjs/media/datajs/serializer`.

**An error renderer.** `_errorLocation` prints a `ParseError` —
`path:line:column`, a span, or the file — and is the only reader of that
type's `metadata`, `end` and `path` fields together. The type lives in
`fjs/compiler/parser/types.ts`; its rendering lives two modules away in the
command.

**The proofs' dump.** `_stringifyTree`, which
[157](../../media/json/todo/157-json-djs-shared-value-machine.md) already routes to
`treeSerialize`.

### Proposal

- `fjs/media/json/serializer` gains a fallible `tryStringify` over the
  DataJS `Unknown`, the mirror of DataJS's own, with today's refusal
  wording and today's short circuit — no item after a refused one is
  walked; `jsonText` in the command becomes `tryStringify(value)`. The
  walk itself is one instance of the
  `treeSerialize` shape 157 already wants to unify, so land it as that
  factory's fallible form rather than a fourth walker.
- `_errorLocation` moves beside `ParseError`, in `fjs/compiler/parser`, as the
  type's renderer; [parse-error-location-format](../../media/json/todo/parse-error-location-format.md)
  then changes the type and its renderer in one module.

The command module is left with routing and the effect chain, which is
what its doc claims.

### Tasks

- [ ] `tryStringify` in `fjs/media/json/serializer` with a proof of each
      refusal and of the short circuit, `firstRefusal`'s forty doublings
      moved with the walk; the command imports it.
- [ ] `_errorLocation` into `fjs/compiler/parser`; the command imports it; its
      proof moves with it.
- [ ] `tsc`, `fjs test`.

### Related

- [157-json-djs-shared-value-machine.md](../../media/json/todo/157-json-djs-shared-value-machine.md) —
  counts three walkers; `jsonValue` is a fourth in the same file as the
  third.
- [parse-error-location-format.md](../../media/json/todo/parse-error-location-format.md) —
  changes what `ParseError` carries; easier with its renderer beside it.
- [070-compiler-flags.md](./070-compiler-flags.md) — adds routes to `outputText`,
  which is the job this module should be left with.
