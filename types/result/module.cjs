const result = require('./module.f.mjs')
const { ok, error } = result.default

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
