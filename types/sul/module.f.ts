export type Level = {
    readonly count: (i: bigint) => bigint
    readonly sum: (i: bigint) => bigint
    readonly encode: (sequence: readonly bigint[]) => bigint
}

export const level = (ln: bigint): Level => {
    const nm1 = 1n << ln
    const n = nm1 + 1n
    const nm2 = n - 2n
    const n2m1 = nm1 << 1n
    const count = (i: bigint) => i < 0n ? 0n : (nm1 << i) + 1n
    const sum = (i: bigint) => (n2m1 << i) - nm2 + i
    return {
        count,
        sum,
        encode: sequence =>
            sequence.slice(0, -2).reduce((a, b) => a + sum(b - 1n), 0n)
            + sum(sequence.at(-2)!)
            + sequence.at(-1)!
            - n
    }
}
