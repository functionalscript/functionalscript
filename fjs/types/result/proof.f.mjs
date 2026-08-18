/**
 * @import { Result } from './types.ts'
 */

import { error, ok, unwrap, invert, mapOk, okThen } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

const example = () => {
    /** @type {Result<number, string>} */
    const success = ok(42)
    /** @type {Result<number, string>} */
    const failure = error('Something went wrong')

    assertEq(unwrap(success), 42, 'error')
    const [kind, v] = failure
    assertEq(kind, 'error')
    // `v` is inferred as `string` here
    assertEq(v, 'Something went wrong', 'error')
}

const invertTest = () => {
    const [k0, v0] = invert(ok(42))
    assert(!(k0 !== 'error' || v0 !== 42), [k0, v0])
    const [k1, v1] = invert(error('oops'))
    assert(!(k1 !== 'ok' || v1 !== 'oops'), [k1, v1])
}

const mapOkTest = () => {
    /** @type {(n: number) => number} */
    const inc = n => n + 1
    const [k0, v0] = mapOk(inc)(ok(41))
    assert(!(k0 !== 'ok' || v0 !== 42), [k0, v0])
    const [k1, v1] = mapOk(inc)(error('oops'))
    assert(!(k1 !== 'error' || v1 !== 'oops'), [k1, v1])
}

const okThenTest = () => {
    /** @type {(n: number) => Result<string, string>} */
    const half = n => n % 2 === 0 ? ok(`${n / 2}`) : error('odd')
    const [k0, v0] = okThen(half)(ok(42))
    assert(!(k0 !== 'ok' || v0 !== '21'), [k0, v0])
    // `f` itself failing: the chain reports `f`'s own error.
    const [k1, v1] = okThen(half)(ok(41))
    assert(!(k1 !== 'error' || v1 !== 'odd'), [k1, v1])
    // An incoming `error` skips `f` and passes through unchanged, keeping its
    // own error type: the result is `Result<string, string | number>`.
    /** @type {Result<number, number>} */
    const incoming = error(7)
    const [k2, v2] = okThen(half)(incoming)
    assert(!(k2 !== 'error' || v2 !== 7), [k2, v2])
}

export const proof = {
    example,
    invertTest,
    mapOkTest,
    okThenTest,
    throw: {
        unwrapError: () => unwrap(error('oops')),
    },
}
