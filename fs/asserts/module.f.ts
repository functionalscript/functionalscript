export const todo = (): never => { throw 'not implemented' }

export const assert: (v: boolean, msg?: unknown) => asserts v = (v, msg = 'assertion failed') => {
    if (!v) throw msg
}

export const assertEq = <T>(a: T, b: T, msg?: unknown): void =>
    assert(a === b, [a, b, msg])

export type Assert<T extends true> = T
