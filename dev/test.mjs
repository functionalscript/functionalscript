import { loadModuleMap, exit, env } from './module.mjs'

/** @type {(f: (s: string) => void) => (s: string) => <T>(_: T) => T} */
const anyLog = f => s => state => {
    f(s)
    return state
}

/**
 * @template T
 * @typedef {readonly['ok', T]} Ok
 */

/**
 * @template E
 * @typedef {readonly['error', E]} Error
 */

/**
 * @template T
 * @template E
 * @typedef {Ok<T>|Error<E>} Result
 */

/** @type {<T>(f: () => T) => Result<T, unknown>} */
const tryCatch = f => {
    // Side effect: `try catch` is not allowed in FunctionalScript.
    try {
        return ['ok', f()]
    } catch (e) {
        return ['error', e]
    }
}

/** @type {<R>(f: () => R) => <T>(state: T) => readonly[R, number, T]} Measure} */
const measure = f => state => {
    const b = performance.now()
    const r = f()
    const e = performance.now()
    return [r, e - b, state]
}

// test runner.
const main = async() => {
    const moduleMap = await loadModuleMap()

    /** @type {any} */
    const f = moduleMap['./dev/test/module.f.cjs'].default
    const r = f({
        moduleMap,
        log: anyLog(console.log),
        error: anyLog(console.error),
        measure,
        tryCatch,
        env,
    })
    exit(r[0])
}

main()