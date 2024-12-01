import result, * as Result from './module.f.mjs'
const { ok, error } = result

/** @type {<T>(f: () => T) => Result.Result<T, unknown>} */
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
