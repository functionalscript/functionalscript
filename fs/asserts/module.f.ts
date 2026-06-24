export const todo = (): never => { throw 'not implemented' }

export const assert: (v: boolean, msg?: unknown) => asserts v = (v, msg = 'assertion failed') => {
    if (!v) throw msg
}

export const assertEq = <T>(...x: readonly[T, T, unknown?]): void => {
    const [a, b] = x
    assert(a === b, x)
}

export type Assert<T extends true> = T
