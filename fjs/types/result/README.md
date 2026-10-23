# Result

`Result<T, E>` is how a FunctionalScript function says it can fail. It is a
two-element tuple, so it needs no class and survives being written to JSON:

```ts
type Result<T, E> = readonly ['ok', T] | readonly ['error', E]
```

[`module.f.js`](./module.f.js) builds, inspects and chains results, and
[`types.ts`](./types.ts) declares `Ok<T>`, `Error<E>` and `Result<T, E>`.

## Making and reading a result

```js
import { error, ok, unwrap } from './module.f.js'

const success = ok(42)        // ['ok', 42]
const failure = error('bad')  // ['error', 'bad']

unwrap(success)               // 42
const [kind, value] = failure // kind is 'error', value is 'bad'
```

Read a result by its tag, `result[0] === 'ok'`, and TypeScript narrows
`result[1]` to the value or the error. `unwrap` throws the error instead, so
keep it for tests and for places where an error would be a bug.

## Chaining steps

|Function      |Does                                                                                  |
|--------------|--------------------------------------------------------------------------------------|
|`mapOk(f)`    |applies `f` to an `ok` value; passes an `error` through                               |
|`okThen(f)`   |runs `f`, which itself answers a `Result`, on an `ok` value; passes an `error` through|
|`okList(list)`|turns an array of results into a result of an array, keeping the first error          |
|`invert(r)`   |swaps `ok` and `error`                                                                |

```js
import { error, mapOk, ok, okList, okThen } from './module.f.js'

const half = n => n % 2 === 0 ? ok(n / 2) : error('odd')

okThen(half)(ok(8))            // ['ok', 4]
okThen(half)(ok(3))            // ['error', 'odd']
okThen(half)(error('earlier')) // ['error', 'earlier']: half never runs
mapOk(n => n + 1)(ok(1))       // ['ok', 2]
okList([ok(1), error('a'), error('b')]) // ['error', 'a']
```

**`okThen` unions the error types.** A chain that parses JSON (`string` errors)
and then checks a schema (`ValidationError`) answers
`Result<T, string | ValidationError>`, and the error that stops it is passed
on as the very tuple it was.

**Use `okThen` when each step needs only the value before it.** A chain whose
later steps also read earlier values would nest a closure per step; write that
as a flat sequence of guards instead, as [`fjs/AGENTS.md`](../../AGENTS.md)
asks, destructuring each result once:
`const [tag, value] = r; if (tag === 'error') { return r }`, after which
`value` is the `ok` payload.

## When to use `Result`, and when not

- **Use it** for anything a caller's input can make fail: parsing, validation,
  a lookup that must succeed.
- **Use `Nullable`** ([`nullable`](../nullable/README.md)) when absence needs
  no explanation, such as a key that is not in a map.
- **Throw** only for a broken invariant, where an error means the program
  itself is wrong.

An effect that performs I/O carries the same idea one level up: its error
channel is a `Result` ([`fjs/effects`](../../effects/README.md)).
