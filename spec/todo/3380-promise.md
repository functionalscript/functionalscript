# Promise

**Not required for I/O.** I/O is done with effects
([io-effects](./io-effects.md), [`fjs/effects`](../../fjs/effects/module.f.mjs)):
an effect is plain data, and the promises a real runner uses live in the runner
— host code — not in the language. This feature is therefore wanted for
JavaScript interop and for `async`/`await` sugar, and nothing in the I/O design
waits on it.

It could be blocked until we solve the ownership problem.

Promise is the main object. `async` and `await` are syntax sugars. If we can safely work with promises, we can transform a FunctionalScript program with `async` functions into a normal function with Promises.

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
