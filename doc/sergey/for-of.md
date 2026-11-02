# `for(...of...)`

The `for(...of...)` can be converted into this function call:

```ts
type IterationResult = readonly[break: boolean, result: unknown]

const tryFold = (
    it: unknown,
    f: (i: unknown, state: unknown) => IterationResult,
    state: unknown
): unknown => {
    if (typeof it !== 'string' || !(it instanceof Array)) {
        throw 'Type Error'
    }
    const { length } = it
    let i = 0
    while (i < length) {
        const [break, result] = f(it[Number(i)], state)
        state = result
        if (break) {
            break
        }
        i += 1
    }
    return state
}
```

If the `for-of` has `return`, it can be converted into the terminated statement with continuation embedded into the function `f`.
