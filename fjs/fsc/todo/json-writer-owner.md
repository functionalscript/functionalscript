## json-writer-owner. `fjs compile` carries a JSON writer and an error renderer of its own

**Priority:** P4
**Status:** open

### Problem

[`fjs/fsc/module.f.mjs`](../module.f.mjs) says it is one thing — pick a
writer by the output's extension, run it, report — and holds three:

**A JSON writer.** `noJson`, `jsonLeaf`, `jsonMember`, `jsonValue`,
`_tryJson` and `jsonText` are a complete fallible serializer over the
DataJS value model, built from `fjs/media/json/serializer`'s atoms
(`stringSerialize`, `boolSerialize`, `nullSerialize`, `colon`, `arrayWrap`,
`objectWrap`) with its own container recursion:

```js
// jsonValue
return value instanceof Array
    ? mapOk(arrayWrap)(all(value.map(jsonValue)))
    : mapOk(objectWrap)(all(entries(value).map(jsonMember)))
```

The one fact that is the compiler's here is the refusal list — a
non-finite number, a `bigint`, `undefined`, a shared node — and only the
last of those is a `Denotation` question; the other three are a property
of two media types, JSON's leaf set against DataJS's. Its sibling from the
caller's side is already one line: `dataJsText` is
`tryStringify(value)` from `fjs/media/datajs/serializer`.

**An error renderer.** `_errorLocation` prints a `ParseError` —
`path:line:column`, a span, or the file — and is the only reader of that
type's `metadata`, `end` and `path` fields together. The type lives in
`fjs/fsc/parser/types.ts`; its rendering lives two modules away in the
command.

**The proofs' dump.** `_stringifyTree`, which
[157](./157-json-djs-shared-value-machine.md) already routes to
`treeSerialize`.

### Proposal

- `fjs/media/json/serializer` gains a fallible `tryStringify` over the
  DataJS `Unknown`, the mirror of DataJS's own, with today's refusal
  wording; `jsonText` in the command becomes
  `shared ? noJson('a shared node') : tryStringify(value)`, keeping the one
  refusal that is the compiler's. The walk itself is one instance of the
  `treeSerialize` shape 157 §2 already wants to unify, so land it as that
  factory's fallible form rather than a fourth walker.
- `_errorLocation` moves beside `ParseError`, in `fjs/fsc/parser`, as the
  type's renderer; [parse-error-location-format](./parse-error-location-format.md)
  then changes the type and its renderer in one module.

The command module is left with routing and the effect chain, which is
what its doc claims.

### Tasks

- [ ] `tryStringify` in `fjs/media/json/serializer` with a proof of each
      refusal; the command imports it.
- [ ] `_errorLocation` into `fjs/fsc/parser`; the command imports it; its
      proof moves with it.
- [ ] `tsc`, `fjs test`.

### Related

- [157-json-djs-shared-value-machine.md](./157-json-djs-shared-value-machine.md) —
  counts three walkers; `jsonValue` is a fourth in the same file as the
  third.
- [parse-error-location-format.md](./parse-error-location-format.md) —
  changes what `ParseError` carries; easier with its renderer beside it.
- [070-fsc-flags.md](./070-fsc-flags.md) — adds routes to `outputText`,
  which is the job this module should be left with.
