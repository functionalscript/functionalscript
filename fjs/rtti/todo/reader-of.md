## `validate` and `parse` instantiate the kernel twice

**Priority:** P3
**Status:** open

### Problem

The [README](../README.md) says the two readers share the kernel in
[`common`](../common/module.f.mjs) and differ in their `Reader`, so that they
read a container "in the same order by construction". Each module then
instantiates the kernel by hand: `arrayValidate`/`arrayParse`,
`recordValidate`/`recordParse`, `tupleValidate`/`tupleParse`,
`structValidate`/`structParse`, the three `rest` forms, the `or` and the
visitor object with the same `unknown` and `option` arms and the same
comment — the same several dozen lines in
[`validate`](../validate/module.f.mjs) and [`parse`](../parse/module.f.mjs),
where only the `finish` argument and the recursive `read` differ:

```js
// validate
const tupleValidate = constContainerRead(reader)(
    isArray, tupleSchemaEntries, (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared, keep)
// parse
const tupleParse = constContainerRead(reader)(
    isArray, tupleSchemaEntries, (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared, tupleRebuild)
```

The container shapes — `isArray`, `tupleSchemaEntries`, the item accessor,
the fit test — are the part that must agree, and they agree by copy. "By
construction" is true of the kernel and not yet of its instantiation.

### Proposal

One `readerOf` in `common`: from a `Reader` and a record of four `Finish`
functions — `array`, `record`, `tuple`, `struct` — it builds the
instantiations, the `rest` forms, the `or` and the visitor once, with `read`
tied back to the result. `validate` is `readerOf(validateReader, keepAll)`;
`parse` is `readerOf(parseReader, { array: arrayRebuild, record:
recordRebuild, tuple: tupleRebuild, struct: recordRebuild })`. Both modules
shrink to their readers and finishes, and a third reader —
[rtti-parse](../../media/json/todo/rtti-parse.md) wants one over JSON text —
gets the skeleton.

### Tasks

- [ ] `readerOf` in `common`, with proof.
- [ ] `validate` and `parse` reduce to it; their proofs stay as the behaviour
      pins.

### Related

- [rtti-parse](../../media/json/todo/rtti-parse.md) — the next reader.
- [tuple-rebuild-out-of-subset](../parse/todo/tuple-rebuild-out-of-subset.md)
  — a finish's own problem, unaffected.
