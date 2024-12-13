# Promise

It could be blocked until we solve ownership problem.

Promise is the main object. `async`, `await` is a syntax sugar. If we can safely work with promises than we can transform a FunctionalScript program with `async` functions to a normal function with Promises.

## `.then()`

```ts
a.then(f)
```

```ts
const g0 = async(a) => f(await a)
// g0 = a => a.then(f)

const g1 = async(a) => f(await a)

const a = io.wrtieFile('a', 'x')
const p0 = g0(a)
const p1 = g1(a)
```
