# `for(...of...)`

The `for(...of...)` can be converted into this function call:

```ts
type IterationResult = readonly[stop: boolean, result: unknown]

const tryFold = (
    it: unknown,
    f: (i: unknown, state: unknown) => IterationResult,
    state: unknown
): unknown => {
    if (typeof it !== 'string' && !(it instanceof Array)) {
        throw 'Type Error'
    }
    const { length } = it
    let i = 0
    while (i < length) {
        const r = f(it[Number(i)], state)
        if (r.stop) {
            return r
        }
        state = r.state
        i += 1
    }
    return [false, state]
}
```

If the `for-of` has `return`, it can be converted into the terminated statement with continuation embedded into the function `f`.
