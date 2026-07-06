import { error, ok, unwrap, invert, mapOk, type Result } from "./module.f.ts"

const example = () => {
    const success: Result<number, string> = ok(42)
    const failure: Result<number, string> = error('Something went wrong')

    if (unwrap(success) !== 42) { throw 'error' }
    const [kind, v] = failure
    if (kind !== 'error') { throw 'error' }
    // `v` is inferred as `string` here
    if (v !== 'Something went wrong') { throw 'error' }
}

const invertTest = () => {
    const [k0, v0] = invert(ok(42))
    if (k0 !== 'error' || v0 !== 42) { throw [k0, v0] }
    const [k1, v1] = invert(error('oops'))
    if (k1 !== 'ok' || v1 !== 'oops') { throw [k1, v1] }
}

const unwrapError = () => {
    let caught = false
    try { unwrap(error('oops')) } catch (e) {
        if (e !== 'oops') { throw e }
        caught = true
    }
    if (!caught) { throw 'expected throw' }
}

const mapOkTest = () => {
    const [k0, v0] = mapOk((n: number) => n + 1)(ok(41))
    if (k0 !== 'ok' || v0 !== 42) { throw [k0, v0] }
    const [k1, v1] = mapOk((n: number) => n + 1)(error('oops'))
    if (k1 !== 'error' || v1 !== 'oops') { throw [k1, v1] }
}

export const proof = { example, invertTest, unwrapError, mapOkTest }
