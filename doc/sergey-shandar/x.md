```ts
type StructEqStack =
undefined |
{
    readonly tag: 'value'
    readonly a: unknown,
    readonly b: unknown,
    readonly n: StructEqStack
} |
{
    readonly tag: 'array'
    readonly i: number
    readonly a: readonly unknown[],
    readonly b: readonly unknown[],
    readonly n: StructEqStack
} |
{
    readonly tag: 'object'
    readonly i: number
    readonly a: readonly Entry[],
    readonly b: readonly Entry[],
    readonly n: StructEqStack
}

type Entry = readonly[string, unknown]

const structEq = (a: unknown, b: unknown): boolean => {
    let x: StructEqStack = { a, b, n: undefined }
    while (true) {
        if (x === undefined) { return true }
        const { a, b } = x
        if (Object.is(a, b)) {
            x = x.n
            continue
        }
        if (a instanceof Array) {
            if (b instanceof Array && a.length === b.length) {

            }
            return false
        }
    }
}
```
