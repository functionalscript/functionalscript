import { error, ok, unwrap, invert, mapOk, type Result } from "./module.f.ts"
import { assert } from '../../asserts/module.f.ts'

const example = () => {
    const success: Result<number, string> = ok(42)
    const failure: Result<number, string> = error('Something went wrong')

    assert(unwrap(success) === 42, 'error')
    const [kind, v] = failure
    assert(kind === 'error', 'error')
    // `v` is inferred as `string` here
    assert(v === 'Something went wrong', 'error')
}

const invertTest = () => {
    const [k0, v0] = invert(ok(42))
    assert(!(k0 !== 'error' || v0 !== 42), [k0, v0])
    const [k1, v1] = invert(error('oops'))
    assert(!(k1 !== 'ok' || v1 !== 'oops'), [k1, v1])
}

const unwrapError = () => {
    let caught = false
    try { unwrap(error('oops')) } catch (e) {
        assert(e === 'oops', e)
        caught = true
    }
    assert(caught, 'expected throw')
}

const mapOkTest = () => {
    const [k0, v0] = mapOk((n: number) => n + 1)(ok(41))
    assert(!(k0 !== 'ok' || v0 !== 42), [k0, v0])
    const [k1, v1] = mapOk((n: number) => n + 1)(error('oops'))
    assert(!(k1 !== 'error' || v1 !== 'oops'), [k1, v1])
}

export const proof = { example, invertTest, unwrapError, mapOkTest }
