## json-writer-owner. `fjs compile` carries an error renderer and the proofs' dump of its own

**Priority:** P4
**Status:** wip

### Problem

[`fjs/compiler/module.f.mjs`](../module.f.mjs) says it is one thing — pick a
writer by the output's extension, run it, report — and holds two:

**An error renderer.** `_errorLocation` prints a `ParseError` —
`path:line:column`, a span, or the file — and is the only reader of that
type's `metadata`, `end` and `path` fields together. The type lives in
`fjs/compiler/parser/types.ts`; its rendering lives two modules away in the
command.

**The proofs' dump.** `_stringifyTree`, which
[157](../../media/json/todo/157-json-djs-shared-value-machine.md) already routes to
`treeSerialize`.

### Proposal

- `_errorLocation` moves beside `ParseError`, in `fjs/compiler/parser`, as the
  type's renderer; [parse-error-location-format](../../media/json/todo/parse-error-location-format.md)
  then changes the type and its renderer in one module.

The command module is left with routing and the effect chain, which is
what its doc claims.

### Tasks

- [x] JSON's leaf rule out of the command, with a proof of each refusal
      beside it; the command imports the one call. Done: `tryJsonStringify`
      in `fjs/media/datajs/serializer`, the DataJS read under JSON's leaf
      rule, since a JSON document is the tree a DataJS graph unfolds to and
      `fjs/media/json` is what DataJS imports, not the reverse.
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
