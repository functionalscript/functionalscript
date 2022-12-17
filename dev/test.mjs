import { loadModuleMap } from './module.mjs'

const consoleLog = console.log

/** @type {(s: string) => <T>(_: T) => T} */
const log = s => state => {
    consoleLog(s)
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

/** @type {<T>(_: T) => readonly[number, T]} */
const performanceNow = state => [performance.now(), state]

// test runner.
const main = async() => {
    const moduleMap = await loadModuleMap()

    /** @type {any} */
    const f = moduleMap['./dev/test/module.f.cjs'].exports
    f({
        moduleMap,
        log,
        performanceNow,
        tryCatch,
    })
}

main()