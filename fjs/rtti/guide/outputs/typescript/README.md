# The TypeScript type

**Status:** implemented

A schema has a TypeScript type twice over: statically, as `Ts<typeof s>`,
which the type checker computes, and as text, which the runtime printer
writes.

```ts
const s = { a: or(option, number), b: or(number, undefined) }
type S = Ts<typeof s>
// { readonly a?: number } & { readonly b: number | undefined }
printer()(s)
// '{readonly"a"?:number,readonly"b":undefined|number}'
```

`Ts<>` is what makes a reader's result typed: `parse(s)` and `validate(s)`
return `Ts<typeof s>` on success, so a schema declared once is both the check
and the static type, with no second declaration to drift.

The two renderings denote the same set, with one known exception, and are
spelled differently. The exception is a rest that is empty without being
written `or()`, such as `rest([42], [or()])`: the printer drops its tail and
`Ts<>` keeps a wider one
([how `RestTs` renders a rest](../../../ts/README.md#how-restts-renders-a-rest)).

| | `Ts<typeof s>` | `printer()(s)` |
| --- | --- | --- |
| computed by | the type checker | a function, at run time |
| goes through | the schema as written | the data form, `toData(s)` |
| a struct | required and optional keys as an intersection | one object type, keys sorted |
| a recursive schema | a recursive type | a named alias, `type tree = …` |

Every container is `readonly`; `printer(true)` drops the modifier. A key
admitting absence is optional, `a?:`, and its value type leaves out
`undefined` unless the schema admits it too — the difference
[`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes)
draws ([absence](../../schemas/option/README.md)). A bare tuple renders at its
exact length, and a `rest` as a tail
([open containers](../../schemas/open-containers/README.md)).

## Examples

The demo on this page runs the *Optional or undefined* lesson:
`{ a: or(option, number), b: or(number, undefined) }`, whose TypeScript type
marks `a` optional and gives `b` the type `undefined|number`. Leave `b` out of
the value to see both readers refuse it; give it `undefined` to see them
accept it. The lesson is defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- TypeScript: [object types](https://www.typescriptlang.org/docs/handbook/2/objects.html),
  [conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html),
  which `Ts<>` is built from

## Where it is implemented

`Ts<>` in [`ts/types.ts`](../../../ts/types.ts), whose
[README](../../../ts/README.md) explains how it avoids TS2589; `printer`,
`dataToTs` and their marked forms in [`ts/module.f.mjs`](../../../ts/module.f.mjs).
