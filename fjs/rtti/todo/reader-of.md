## `validate` and `parse` instantiate the kernel twice

**Priority:** P3
**Status:** open

### Problem

The [README](../README.md) says the two readers share the kernel in
[`common`](../common/module.f.mjs) and differ in their `Reader`, so that they
read a container "in the same order by construction". Each module then
instantiates the kernel by hand: `arrayValidate`/`arrayParse`,
`recordValidate`/`recordParse`, `tupleValidate`/`tupleParse`,
`structValidate`/`structParse`, the `rest` forms for a tuple, a struct and
the rest itself, the `or` and the
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

One `readerOf` in `common`: from a `Reader`, a record of four `Finish`
functions — `array`, `record`, `tuple`, `struct` — and the data form's
`emptyRest`, it builds the instantiations, the fit tests, the `rest` forms,
the `or` and the visitor once, with `read` tied back to the result.
`emptyRest` is an argument and not an import for the reason
`containerRead` already takes it as one: it lives in `data`, which imports
`common`, and `common` must not import `data`. It decides the length rule
an `array(or())` needs — that schema is the empty array, not any number of
holes — so the array and `rest` fits are written once inside `readerOf`
over it, `value.length <= declared || !emptyRest(…)`, rather than once per
reader. `validate` is `readerOf(validateReader, keepAll, emptyRest)`;
`parse` is `readerOf(parseReader, { array: arrayRebuild, record:
recordRebuild, tuple: tupleRebuild, struct: recordRebuild }, emptyRest)`.
Both modules
shrink to their readers and finishes, and a third reader —
[rtti-parse](../../media/json/todo/rtti-parse.md) wants one over JSON text —
gets the skeleton.

### Tasks

- [ ] `readerOf` in `common`, taking `emptyRest` as an argument, with proof
      that `array(or())` still admits the empty array alone.
- [ ] `validate` and `parse` reduce to it; their proofs stay as the behaviour
      pins.

### Related

- [rtti-parse](../../media/json/todo/rtti-parse.md) — the next reader.
- [tuple-rebuild-out-of-subset](../parse/todo/tuple-rebuild-out-of-subset.md)
  — a finish's own problem, unaffected.
