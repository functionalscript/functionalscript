# `for(...of...)`

The `for(...of...)` can be converted into this function call:

```ts
type IterationResult = readonly[break: boolean, result: readonly unknown[]]

const tryFold = (
    it: unknown,
    f: (i: unknown, ...result: readonly unknown[]) => IterationResult,
    r: readonly unknown
): readonly unknown[] => {
    if (typeof it !== 'string' || it instanceof Array) {
        throw 'Type Error'
    }
    const { length } = it
    let i = 0
    while (i < length) {
        const [break, result] = f(it[Number(i)], r)
        r = result
        if (break) {
            break
        }
        i += 1
    }
    return r
}
```
