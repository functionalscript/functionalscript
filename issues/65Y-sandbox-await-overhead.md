# 65Y-sandbox-await-overhead. `sandbox` async overhead inflates test times

**Priority:** P2
**Status:** done

## Problem

When `sandbox` routes the test function's return value through `awaitPromise`
(the boxing effect handler), every synchronous test pays the cost of an extra
`async` call, a Promise allocation, microtask scheduling, and array unboxing —
even though the vast majority of tests are synchronous and need none of this.

```ts
// slow: always allocates a Promise and unboxes the array
const value = await awaitPromise(f())
result = ok(value[0] as T)
```

Measured with `npm run fst` on 1475 tests:

| implementation | time |
|---|---|
| `await awaitPromise(f())` | ~29 000 – 30 000 ms |
| `p instanceof Promise ? await p : p` | ~7 000 ms |

**~4× slowdown** for a test suite of this size. Because each test is timed
individually with `performance.now()`, the spurious microtask scheduling also
inflates per-test durations, making timing measurements less accurate.

## Root cause

`awaitPromise` is an `async` function that always returns a `Promise<readonly [unknown]>`.
Passing a synchronous return value through it forces the engine to:

1. Enter an async frame
2. Allocate a `Promise` resolved to `[value]`
3. Schedule a microtask to continue after the `await`
4. Unbox `value[0]`

The boxing trick (`async p => [p instanceof Promise ? await p : p]`) is
necessary in the `registerModule`/asyncRun path because the effect handler must
return `Promise<T>` and there is no other way to prevent `Promise.resolve()`
from following a thenable. But `sandbox` is already inside an `async` function
and can check directly — no boxing needed.

## Fix

```ts
// fast: only awaits when the test actually returns a real Promise
const p = f()
const value = p instanceof Promise ? await p : p
after = performance.now()
result = ok(value as T)
```

The `instanceof Promise` check is free for synchronous tests; the `await` is
only entered when `f()` genuinely returns a `Promise`. This also keeps the
`after = performance.now()` capture as close as possible to `f()` completing,
consistent with the time-measurement rule in `AGENTS.md`.

## Related

- [i65Y-registermodule-thenable](./65Y-registermodule-thenable.md) — boxing fix
  that motivated this issue; boxing belongs only in the asyncRun handler
- [i206](./206-worker-sandbox.md) — worker sandbox, which would make this moot
