const result = require('../../types/result/main.f.cjs')

/** @type {<T>(f: () => T) => result.Result<T, unknown>} */
const tryCatch = f => {
    // Side effect: `try catch` is not allowed in FunctionalScript.
    try {
        return result.ok(f())
    } catch (e) {
        return result.error(e)
    }
}

module.exports = {
    /** @readonly */
    tryCatch,
}
