## json-writer-owner. `fjs compile` carries a JSON writer and an error renderer of its own

**Priority:** P4
**Status:** open

### Problem

[`fjs/compiler/module.f.mjs`](../module.f.mjs) says it is one thing — pick a
writer by the output's extension, run it, report — and holds three:

**A JSON writer's leaf rule.** `noJson`, `jsonLeaf`, `_tryJson` and
`jsonText` are JSON's fallible leaf rule over the DataJS value model,
handed to the DataJS writer's `_tryTreeSerialize`, which reads the value into
its graph, spelling each leaf where the read meets it, a node reached twice
met once, and unfolds the tree only then:

```js
// _tryJson
mapOk(concat)(_tryTreeSerialize(jsonLeaf)(stringSerialize)(value))
```

The walk is the DataJS writer's, so it is no fourth walker; what the
command still holds is the refusal list — a non-finite number, a `bigint`,
`undefined` — and none of it is the compiler's: it is a property of two
media types, JSON's leaf set against DataJS's. Its sibling from the
caller's side is already one line: `dataJsText` is `tryStringify(value)`
from `fjs/media/datajs/serializer`.

**An error renderer.** `_errorLocation` prints a `ParseError` —
`path:line:column`, a span, or the file — and is the only reader of that
type's `metadata`, `end` and `path` fields together. The type lives in
`fjs/compiler/parser/types.ts`; its rendering lives two modules away in the
command.

**The proofs' dump.** `_stringifyTree`, which
[157](../../media/json/todo/157-json-djs-shared-value-machine.md) already routes to
`treeSerialize`.

### Proposal

- JSON's leaf rule, `jsonLeaf` with its refusal wording, moves beside the
  atoms it is built from, and the tree writer takes it there, so that
  `jsonText` in the command becomes one imported call — in
  `fjs/media/datajs/serializer`, since the tree writer reads the DataJS
  graph and `fjs/media/json` is what DataJS imports, not the reverse.
- `_errorLocation` moves beside `ParseError`, in `fjs/compiler/parser`, as the
  type's renderer; [parse-error-location-format](../../media/json/todo/parse-error-location-format.md)
  then changes the type and its renderer in one module.

The command module is left with routing and the effect chain, which is
what its doc claims.

### Tasks

- [ ] JSON's leaf rule out of the command, with a proof of each refusal
      beside it; the command imports the one call.
- [ ] `_errorLocation` into `fjs/compiler/parser`; the command imports it; its
      proof moves with it.
- [ ] `tsc`, `fjs test`.

### Related

- [157-json-djs-shared-value-machine.md](../../media/json/todo/157-json-djs-shared-value-machine.md) —
  counts three walkers; the JSON walk was a fourth, in the same file as the
  third, until #2526 made it the DataJS writer's read under JSON's leaf
  rule.
- [parse-error-location-format.md](../../media/json/todo/parse-error-location-format.md) —
  changes what `ParseError` carries; easier with its renderer beside it.
- [070-compiler-flags.md](./070-compiler-flags.md) — adds routes to `outputText`,
  which is the job this module should be left with.
