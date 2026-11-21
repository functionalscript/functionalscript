## The binary format's code tables, written once

**Priority:** P3
**Status:** open

### Problem

[`instruction`](../instruction/module.f.js) keeps one table of opcodes
"for the parser and both writers", and derives each direction from it.
Every other code table of the binary format is written twice, by hand,
once in each direction, in
[`binary/write`](../binary/write/module.f.js) and
[`binary/parse`](../binary/parse/module.f.js):

```js
// write
const refTypes = { funcref: 0x70, externref: 0x6f }
const valTypes = { i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c, ...refTypes }
const externKinds = { func: 0, table: 1, memory: 2, global: 3 }
const nameIds = { module: 0, function: 1, local: 2, label: 3, type: 4, table: 5, memory: 6, global: 7, elem: 8, data: 9, field: 10, tag: 11 }
// parse
const refTypes = { 0x70: 'funcref', 0x6f: 'externref' }
const valTypes = { 0x7f: 'i32', 0x7e: 'i64', 0x7d: 'f32', 0x7c: 'f64', ...refTypes }
const externKinds = { 0: 'func', 1: 'table', 2: 'memory', 3: 'global' }
const nameIds = ['module', 'function', 'local', 'label', 'type', 'table', 'memory', 'global', 'elem', 'data', 'field', 'tag']
```

The sections are written three times: `known` in the writer, as rows of
id, name and payload in the order the format wants (`…, 9 elem, 12
datacount, 10 code, 11 data`); `known` in the parser, keyed by id, with a
separate `order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 10, 11]`; and `place`'s
`present` list in [`wat`](../wat/module.f.js), the twelve names in that
order again. [`types.ts`](../types.ts) lists the names a fourth time, as
`SectionName`.

Smaller rules ride the same split:

- which name subsections are indirect maps — `local`, `label`, `field` —
  is tested in the writer and in the parser;
- an element segment's "implicit table 0" is the same expression in the
  writer and in `wat`;
- a block opener is `block`, `loop` or `if` in the parser and in `wat`,
  which are the rows of kind `'block'` in the instruction table;
- the preamble is eight literal bytes in the writer and `magic` and
  `version` in the parser.

That the parser reads what the writer writes rests on each pair having
been inverted correctly, and a round-trip proof covers only the codes a
fixture happens to use.

### Proposal

A module beside `instruction` — `fjs/media/wasm/format`, say — holds the
rows as `[code, name]` tuples: `numTypes`, `refTypes`, `externKinds`,
`nameSubsections` (with the indirect flag as a third column) and
`sections`, in the format's order. It derives both lookups from each, as
`instruction` derives `single` and `byMnemonic`, and exports `magic`,
`version` and `implicitTable(element)`. `types.ts` derives `RefType`,
`ExternKind` and `SectionName` from the rows, as it already derives
`Instruction`.

Each consumer keeps what is its own: the writer its encoder per section,
the parser its reader, `wat` its presence test — three maps by name over
one shared order.

The unsigned LEB128 writer and reader belong to the same module; see
[one loader](../../../ir/l0/host/todo/one-loader.md), which counts four
spellings of it.

### Drawbacks

- The derived tables must stay literal-typed for `Record<RefType, number>`
  lookups and for `nameIds.module`, so the rows are `@type {const}` and
  the derivation needs a mapped type rather than `Object.fromEntries`'s
  loose one.
- About thirty to forty lines go. The size is not the argument; the
  hand-inversion is.
