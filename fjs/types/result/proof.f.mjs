import { error, ok, unwrap, invert, mapOk } from './module.f.mjs'
/** @import { Result } from './types.ts' */
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

export const proof = {
    example,
    invertTest,
    mapOkTest,
    throw: {
        unwrapError: () => unwrap(error('oops')),
    },
}
