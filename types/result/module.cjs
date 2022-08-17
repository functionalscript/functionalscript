const result = require('./module.f.cjs')
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

module.exports = {
    /** @readonly */
    tryCatch,
}
