# Asserts

The checks proofs and runtime guards use. Each one throws when it fails and
returns nothing, or the checked value, when it holds.

| Function | Throws unless | Returns |
|---|---|---|
| `assert(v, msg?)` | `v` is `true` | nothing; narrows `v` for the type checker |
| `assertEq(a, b, msg?)` | `a === b` | nothing |
| `assertStructurallySame(a, b, msg?)` | `a` and `b` have equal leaves under the same shape | nothing |
| `assertNotNullish(a, msg?)` | `a` is neither `null` nor `undefined` | `a` |
| `assertOk(r)` | the result `r` is `ok` | the `ok` value |
| `assertError(r)` | the result `r` is an `error` | the error |
| `assertErrorPath(path)(r)` | `r` is an `error` whose `path` is `path` | nothing |
| `todo()` | never | always throws `'not implemented'` |

```js
import { assert, assertEq, assertStructurallySame, assertOk } from './module.f.js'

assert(1 < 2)
assertEq(assertOk(['ok', 5]), 5)
assertStructurallySame({ a: 1, b: [2] }, { b: [2], a: 1 })
assertEq(1, 2, 'why')   // throws [1, 2, 'why']
```

## Which one to use

- Compare numbers, strings and other primitives with `assertEq`.
- Compare two objects or arrays built separately with
  `assertStructurallySame`. `assertEq` only asks whether they are the same
  reference. See
  [`types/object/structurally_same`](../types/object/structurally_same/README.md)
  for what structural sameness does not cover.
- Unwrap a value that may be missing with `assertNotNullish`, inline:
  `const x = assertNotNullish(f())`.
- Unwrap a `Result` with `assertOk` or `assertError`, then compare what comes
  out.

A failed assertion throws its message, or the compared values, as a plain
value rather than an `Error`, so the test runner prints exactly what differed.
