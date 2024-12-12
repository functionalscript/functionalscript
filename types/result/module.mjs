import * as result from './module.f.mjs'
const { ok, error } = result

/** @type {<T>(f: () => T) => result.Result<T, unknown>} */
const tryCatch = f => {
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
