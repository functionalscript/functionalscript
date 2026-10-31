# Object

Helpers for plain objects used as records and dictionaries.
[`module.f.mjs`](./module.f.mjs) holds the functions, and
[`types.ts`](./types.ts) the record shapes `OptionalMap`, `RequiredMap`,
`StringMap` and `Entry`.

```js
import { at, definedEntries, fromEntries, isObject, sort, structurallySame } from './module.f.mjs'

at('x')({ x: 1 })              // 1
at('toString')({})             // null: not an own property
fromEntries([['b', 1], ['a', 2]]) // { b: 1, a: 2 }
sort([['b', 1], ['a', 2]])     // the entries in key order, as a list: [['a', 2], ['b', 1]]
isObject([])                   // false: an array is not a record
definedEntries({ a: 1, b: undefined }) // [['a', 1]]
structurallySame({ a: [1] }, { a: [1] }) // true
```

## The functions

|Function                               |Does                                                                           |
|---------------------------------------|-------------------------------------------------------------------------------|
|`at(name)(object)`                     |the object's **own** property `name`, or `null` (also for a stored `undefined`)|
|`fromEntries(list)`                    |an object from a [`List`](../list/README.md) of `[key, value]` entries         |
|`sort(list)`                           |the entries in key order; for a repeated key, the last value wins              |
|`fromMap(map)`                         |an object from an [`ordered_map`](../ordered_map/module.f.js)                 |
|`isObject(value)`                      |whether `value` is a non-null object that is not an array                      |
|`definedEntries(o)`, `definedValues(o)`|the entries or values whose value is not `undefined`                           |
|`structurallySame(a, b)`               |deep equality over plain data                                                  |

## Why `at` and not `object[name]`

`object[name]` also finds what the object inherits. `({})['constructor']` is
the `Object` function, and `({})['__proto__']` is a prototype. For an object
used as a dictionary, with keys that come from input, those answers are bugs.
`at` reads only own properties and answers `null` for anything else, which is
also the library's way to say "absent" ([`nullable`](../nullable/README.md)).

FunctionalScript's compiler refuses `.` and `[]` access to the names the
built-in prototypes hold ([`js/prototype`](../../js/prototype/README.md)),
for the same reason.

## Record types

[`types.ts`](./types.ts) holds the shapes the library uses for records:

- `StringMap<T>`: a dictionary from strings to `T`, where any key may be
  missing, so reading one gives `T | undefined`.
- `OptionalMap<K, T>` and `RequiredMap<K, T>`: records over a known set of
  keys, each optional or required.
- `Entry<T>`: one `[key, value]` pair.
- `OneKey`, `SingleProperty` and `NotUnion`: type-level checks for a record
  with exactly one key.
