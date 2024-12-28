import { ok, error, type Result } from './module.f.ts'

const tryCatch
    : <T>(f: () => T) => Result<T, unknown>
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
