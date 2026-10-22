# Recursion

**Status:** implemented

A schema can use itself by being a thunk that names itself:

```js
const tree = () => ['const', { value: number, children: array(tree) }]
```

A thunk is a function returning a descriptor, `['const', c]` here, and the
readers call it only when they reach it, so the definition can mention `tree`
before `tree` is finished. A constant inside a recursive definition is wrapped
the same way, `() => ['const', c]`, which keeps every name the definition uses
a function.

The data form turns each recursive definition into one named rule, which the
JSON Schema writer emits once under `$defs` and refers to with `$ref`. A
sub-schema that is shared but not recursive is one value too, and the demo's
graph draws it once with an edge per use.

`Ts<>` of a recursive schema can exceed TypeScript's instantiation depth
(TS2589); [`ts/README.md`](../../../ts/README.md) describes the `WithOut`
phantom output type that avoids it.

## Examples

The [RTTI demo](../../../README.md) shows `tree` in its *Recursion* lesson,
drawn by name where it uses itself, and a shared sub-schema in its *Shared
parts* lesson.

## Reference

- TypeScript: [recursive type aliases](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#more-recursive-type-aliases)
- JSON Schema: `$defs` and `$ref`
  ([recursion](https://json-schema.org/understanding-json-schema/structuring#recursion))

## Where it is implemented

`Thunk` and `Info` in [`types.ts`](../../../types.ts); `toData`'s named
rules in [`data`](../../../data/module.f.mjs); `WithOut` in
[`ts/types.ts`](../../../ts/types.ts).
