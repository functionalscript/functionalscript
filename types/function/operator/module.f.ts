type Binary<A, B, R> = (a: A) => (b: B) => R

export type Fold<I, O> = Binary<I, O, O>

export const join
: (separator: string) => Reduce<string>
= separator => value => prior => `${prior}${separator}${value}`

export const concat
: Reduce<string>
= i => acc => `${acc}${i}`

export type Unary<T, R> = (value: T) => R

export const logicalNot
: Unary<boolean, boolean>
= v => !v

export type Equal<T> = Binary<T, T, boolean>

export const strictEqual
: <T>(a: T) => (b: T) => boolean
= a => b => a === b

export type Scan<I, O> = (input: I) => readonly[O, Scan<I,O>]

export type StateScan<I, S, O> = (prior: S) => (input: I) => readonly[O, S]

export const stateScanToScan
: <I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>
= op => prior => i => {
    const [o, s] = op(prior)(i)
    return [o, stateScanToScan(op)(s)]
}

export const foldToScan
: <I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>
= fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

export type Reduce<T> = Fold<T, T>

export const reduceToScan
: <T>(fold: Reduce<T>) => Scan<T, T>
= op => init => [init, foldToScan(op)(init)]

export const addition
: Reduce<number>
= a => b => a + b

export const min
: Reduce<number>
= a => b => a < b ? a : b

export const max
: Reduce<number>
= a => b => a > b ? a : b

export const increment
: (b: number) => number
= addition(1)

export const counter = () => increment
