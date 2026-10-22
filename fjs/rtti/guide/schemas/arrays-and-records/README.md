# Arrays and records

**Status:** implemented

`array(t)` admits an array of any length whose every element is a `t`.
`record(t)` admits an object with any string keys, each holding a `t`.

```js
const tags = array(string)       // readonly string[]
const stock = record(number)     // { readonly [k: string]: number }
```

Both are homogeneous. An array whose positions differ is a
[tuple](../closed-containers/README.md), and an object with known keys is a
struct; [`rest`](../open-containers/README.md) combines the two, declared
members and then any number of members of one schema. `array(or())` admits
only the empty array, an empty rest bounding the length.

## Examples

The [RTTI demo](../../../README.md) shows `record(number)` in its *Dictionary*
lesson and `array` inside the *Shared parts* and *Recursion* lessons.

## Reference

- TypeScript: [arrays](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#arrays)
  and [index signatures](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures)
- JSON Schema: `items` and `additionalProperties`
  ([array](https://json-schema.org/understanding-json-schema/reference/array),
  [object](https://json-schema.org/understanding-json-schema/reference/object))

## Where it is implemented

The unary schemas in [`module.f.mjs`](../../../module.f.mjs); the container
skeletons in [`common`](../../../common/module.f.mjs).
