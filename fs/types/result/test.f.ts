import { error, ok, unwrap, invert, type Result } from "./module.f.ts"

export const example = () => {
    const success: Result<number, string> = ok(42)
    const failure: Result<number, string> = error('Something went wrong')

    if (unwrap(success) !== 42) { throw 'error' }
    const [kind, v] = failure
    if (kind !== 'error') { throw 'error' }
    // `v` is inferred as `string` here
    if (v !== 'Something went wrong') { throw 'error' }
}

export const invertTest = () => {
    const [k0, v0] = invert(ok(42))
    if (k0 !== 'error' || v0 !== 42) { throw [k0, v0] }
    const [k1, v1] = invert(error('oops'))
    if (k1 !== 'ok' || v1 !== 'oops') { throw [k1, v1] }
}
