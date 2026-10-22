# Recursion and sharing

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
JSON Schema writer emits once under `$defs` and refers to with `$ref`.

`Ts<>` of a recursive schema can exceed TypeScript's instantiation depth
(TS2589); [`ts/README.md`](../../../ts/README.md) describes the `WithOut`
phantom output type that avoids it.

## Sharing

A sub-schema used in two places is one value, as any JavaScript value named by
a `const` is:

```js
const address = { street: string, city: string }
const order = { billing: address, shipping: address }
```

The demo's graph draws `address` once, with an edge per use. A value can
share a member the same way, and the two readers treat that differently:
`validate` hands back the value it was given, sharing included, while `parse`
builds a fresh copy for each use.

## Examples

The demo on this page runs the *Recursion* lesson, `tree` drawn by name
where it uses itself, and the *Shared parts* lesson, where `address` is used
twice and drawn once; the drop-down switches between them. The lessons are
defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists them among all the others.

## Reference

- TypeScript: [recursive type aliases](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#more-recursive-type-aliases)
- JSON Schema: `$defs` and `$ref`
  ([recursion](https://json-schema.org/understanding-json-schema/structuring#recursion))

## Where it is implemented

`Thunk` and `Info` in [`types.ts`](../../../types.ts); `toData`'s named
rules in [`data`](../../../data/module.f.mjs); `WithOut` in
[`ts/types.ts`](../../../ts/types.ts).
