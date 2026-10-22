# The canonical data form

**Status:** implemented

`toData(s)` turns a schema — functions and all — into plain data: no
functions, one spelling per set (up to the names of recursive rules), and
comparable.

```js
equal(toData(or(true, false)))(toData(boolean))   // true
subset(toData({ a: 42 }))(toData({ a: number }))  // true
subset(toData({ a: number }))(toData({ a: 42 }))  // false
```

A schema is a set of values, and the data form represents the set, not the
spelling. A union is merged kind by kind, a constant inside its whole kind is
absorbed (`or(42, number)` is all numbers), a member another covers is dropped,
and what is left is ordered canonically. So `equal` answers whether two
schemas admit the same values (two recursive schemas that differ only in their
rule names are a mutual `subset` but not `equal`; see the
[data form's limits](../../../data/README.md#canonical-form)), `subset` whether every value of one is a value
of the other, and `cmp` orders schemas for sorting.

`subset` is **sound and deliberately incomplete**: when it says `true`, it is
true; it may say `false` for a pair whose inclusion it cannot establish.

The other outputs are written from the data form: the
[TypeScript text](../typescript/README.md) and
[JSON Schema](../json-schema/README.md) both go through `toData`, and the data
form has a [reader](../../readers/README.md) of its own, `validate`. A
recursive schema becomes a named rule, which is how those outputs write it
once.

## Examples

The demo on this page runs the *Subset* lesson: `{ a: 42 }` and
`{ a: number }`, which both accept `{"a":42}`. The comparison under the graph
reports that the first is a subset of the second, and not equal to it. Type
`{"a":7}` to see only the second accept it. The lesson is defined in
[`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others. The
*Canonical form* section of every demo shows a schema's data form.

## Reference

- JSON Schema has no inclusion test; TypeScript's
  [assignability](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
  is the closest counterpart of `subset`.

## Where it is implemented

`toData`, `equal`, `cmp`, `subset` and `validate` in
[`data`](../../../data/module.f.mjs), whose
[README](../../../data/README.md) describes the representation.
