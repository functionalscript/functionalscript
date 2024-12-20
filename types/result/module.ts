import * as result from './module.f.mjs'
const { ok, error } = result

const tryCatch
    : <T>(f: () => T) => result.Result<T, unknown>
    = f => {
    // Side effect: `try catch` is not allowed in FunctionalScript.
    try {
        return ok(f())
    } catch (e) {
        return error(e)
    }
}

export default {
    /** @readonly */
    tryCatch,
}
