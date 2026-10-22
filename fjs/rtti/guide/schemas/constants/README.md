# Constants

**Status:** implemented

A primitive used as a schema admits exactly itself: `null`, `undefined`,
`true`, `42`, `'hello'` and `7n` are each a schema whose one value is that
primitive. The comparison is `Object.is`, so the constant `NaN` admits `NaN`,
and `0` and `-0` are two schemas with one value each.

```js
import { parse } from 'functionalscript/fjs/rtti/parse/module.f.mjs'

parse('circle')('circle')  // ['ok', 'circle']
parse('circle')('square')  // ['error', …]
parse({ kind: 'circle', r: 1 })({ kind: 'circle', r: 1 })  // ['ok', …]
```

A constant is the usual tag of a tagged union: `or({ kind: 'circle', r: number },
{ kind: 'square', side: number })` reads the `kind` to tell its members apart
([unions](../unions/README.md)). A struct or a tuple used as a schema is a
constant too, read member by member
([structs and tuples are closed](../closed-containers/README.md)).

`undefined` is a constant like the others: `{ a: undefined }` needs the key
`a`, holding `undefined`. It is not absence, which is
[`option`](../option/README.md)'s.

Inside a recursive definition a constant is written as a thunk,
`() => ['const', c]`, so that every schema the definition names is a function
([recursion](../recursion/README.md)).

## Examples

The demo on this page runs the *Tagged union* lesson:
`or({ kind: 'circle', r: number }, { kind: 'square', side: number })` against
`{"kind":"circle","r":1}`. Change the kind to `"triangle"`, or give the
circle a `side`, to see both readers refuse it. The lesson is defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- TypeScript: [literal types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)
- JSON Schema: `const`
  ([reference](https://json-schema.org/understanding-json-schema/reference/const)).
  A bigint constant becomes a number, which is lossy past
  `Number.MAX_SAFE_INTEGER`, and `undefined` becomes `{ "not": {} }`, since no
  JSON value is `undefined`.

## Where it is implemented

`Const` in [`types.ts`](../../../types.ts); the `Object.is` check in
[`common`](../../../common/module.f.mjs).
