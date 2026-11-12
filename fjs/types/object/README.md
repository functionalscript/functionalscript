# Object

Helpers for plain objects used as records and dictionaries.
[`module.f.js`](./module.f.js) holds the functions, and
[`types.ts`](./types.ts) the record shapes `OptionalMap`, `RequiredMap`,
`StringMap` and `Entry`.

```js
import { definedEntries, fromEntries, isObject, sort, structurallySame } from './module.f.js'
import { entry } from './entry/module.f.js'
import { fromUndefined } from '../nullable/module.f.js'

entry({ x: 1 }, 'x')           // 1
entry({}, 'toString')          // undefined: not an own property
fromUndefined(entry({}, 'x'))  // null: normalize at a nullable API boundary
fromEntries([['b', 1], ['a', 2]]) // { b: 1, a: 2 }
sort([['b', 1], ['a', 2]])     // the entries in key order, as a list: [['a', 2], ['b', 1]]
isObject([])                   // false: an array is not a record
definedEntries({ a: 1, b: undefined }) // [['a', 1]]
structurallySame({ a: [1] }, { a: [1] }) // true
```

## The functions

|Function                               |Does                                                                           |
|---------------------------------------|-------------------------------------------------------------------------------|
|[`entry(object, name)`](./entry/module.f.js)|the enumerable **own** property `name`, or `undefined`                      |
|`fromEntries(list)`                    |an object from a [`List`](../list/README.md) of `[key, value]` entries         |
|`sort(list)`                           |the entries in key order; for a repeated key, the last value wins              |
|`fromMap(map)`                         |an object from an [`ordered_map`](../ordered_map/module.f.js)                 |
|`isObject(value)`                      |whether `value` is a non-null object that is not an array                      |
|`definedEntries(o)`, `definedValues(o)`|the entries or values whose value is not `undefined`                           |
|`structurallySame(a, b)`               |deep equality over plain data                                                  |

## Own-property lookup

`object[name]` also finds what the object inherits. `({})['constructor']` is
the `Object` function, and `({})['__proto__']` is a prototype. For an object
used as a dictionary, with keys that come from input, those answers are bugs.
The shared [`entry`](./entry/module.f.js) helper reads enumerable own
properties and answers `undefined` for a missing, inherited or non-enumerable
property. A stored `null` stays `null`; a stored `undefined` reads as
`undefined`, with [`hasEntry`](./entry/module.f.js) available to distinguish
presence. Use `fromUndefined` at APIs that use the library's `null`
convention ([`nullable`](../nullable/README.md)).

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
