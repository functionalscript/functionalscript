# Unions: `or` and `never`

**Status:** implemented

`or(a, b, …)` admits every value any of its members admits. `never` is the
empty union, `or()`, and admits nothing.

```js
const shape = or(
    { kind: 'circle', r: number },
    { kind: 'square', side: number },
)
const id = or(string, number)
```

`or` is a lazy constructor: it captures its members in a thunk and does no
flattening, deduplication or subset analysis. That algebra is the data form's:
`toData` merges members kind by kind, absorbs a constant into its whole kind
(`or(42, number)` is all numbers), drops a member another covers, and orders
what is left canonically. So two spellings of one set have one data form, and
`equal` says so: `or(true, false)` and `boolean` are equal, and
`subset(toData(42))(toData(number))` holds.

`never` is what an empty `rest` is: `rest(c, never)` is the closed `c`
([open containers](../open-containers/README.md)). A union with
[`option`](../option/README.md) is how a member is made optional.

## Examples

The demo on this page runs the *Two spellings, one set* lesson: pick
`or(true, false)` or `boolean`, and the comparison under the graph reports
`equal → true`; the TypeScript type and the JSON Schema of the two are the
same. The lesson is defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- TypeScript: [union types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
  and [`never`](https://www.typescriptlang.org/docs/handbook/2/functions.html#never)
- JSON Schema: `anyOf`, and `{ "not": {} }` for `never`
  ([reference](https://json-schema.org/understanding-json-schema/reference/combining))

## Where it is implemented

`or` and `never` in [`module.f.mjs`](../../../module.f.mjs); normalization,
`equal`, `cmp` and `subset` in [`data`](../../../data/module.f.mjs), which
documents them ([`data/README.md`](../../../data/README.md)).
