# `aync` / `await` Functions

It could be blocked until we solve ownership problem.

## `Promise`

### `.then()`

```ts
a.then(f)
```

```ts
const g0 = async(a) => f(await a)

const g1 = async(a) => f(await a)

const a = io.wrtieFile('a', 'x')
const p0 = g0(a)
const p1 = g1(a)
```
