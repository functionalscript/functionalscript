const result = require('../../types/result')

/** @type {<T>(f: () => T) => result.Result<T, unknown>} */
const tryCatch = f => {
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