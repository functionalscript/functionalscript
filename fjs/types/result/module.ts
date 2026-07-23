import { ok, error, type Result } from './module.f.ts'

export const tryCatch
    : <T>(f: () => T) => Result<T, unknown>
    = f => {
        // Side effect: `try catch` is not allowed in FunctionalScript.
        try {
            return ok(f())
        } catch (e) {
            return error(e)
        }
    }

export const asyncTryCatch
    : <T>(f: () => Promise<T>) => Promise<Result<T, unknown>>
    = async f => {
        // Side effect: `try catch` is not allowed in FunctionalScript.
        try {
            return ok(await f())
        } catch (e) {
            return error(e)
        }
    }
