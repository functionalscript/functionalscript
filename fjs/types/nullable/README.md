# Nullable

`Nullable<T>` is `T | null`: a value that may be absent. FunctionalScript uses
`null`, and only `null`, for absence, so a function that finds nothing answers
`null` rather than `undefined`. [`module.f.js`](./module.f.js) holds the
helpers, and [`types.ts`](./types.ts) the type.

```js
import { fromUndefined, map, match } from './module.f.js'

map(n => n + 1)(1)                     // 2
map(n => n + 1)(null)                  // null
match(n => n * 2)(() => 'none')(4)     // 8
match(n => n * 2)(() => 'none')(null)  // 'none'
fromUndefined([1][5])                  // null, not undefined
```

## The helpers

|Function           |Does                                                             |
|-------------------|-----------------------------------------------------------------|
|`match(f)(none)(v)`|`f(v)` for a present value, `none()` for `null`                  |
|`map(f)(v)`        |`f(v)` for a present value, `null` passed through                |
|`fromUndefined(v)` |`null` for `undefined`, the value otherwise                      |
|`toOption(v)`      |`[]` for `null`, `[v]` otherwise ([`option`](../option/types.ts))|
|`unwrap(v)`        |the value, asserting it is not `null`                            |
|`mapUnwrap(f)`     |`f` with its `null` answer turned into an assertion              |

## Why `null` and not `undefined`

JavaScript answers `undefined` for a missing property, a missing array item and
a missing argument, and `null` for nothing at all. Using one of them for
absence makes every check a single `=== null`, and JSON can spell `null` but
not `undefined`. So the rule is:

- **Inside FunctionalScript, absence is `null`.**
- **At the boundary with a JavaScript API**, convert with `fromUndefined`, as
  [`array`](../array/README.md)'s `at` does for an index past the end.

## When to use `Nullable`, and when not

Use `Nullable` when there is nothing to say about why a value is missing, such
as a lookup, `first` of an empty list, or an optional field. When the caller
needs to know what went wrong, answer a [`Result`](../result/README.md)
instead. A function named `try…` that answers `Nullable` is the convention for
"this may not work, and that is fine"
([`doc/DESIGN.md`](../../../doc/DESIGN.md)).
