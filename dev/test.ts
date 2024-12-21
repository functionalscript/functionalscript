import { loadModuleMap, exit, env } from './module.ts'
import test from './test/module.f.ts'

const anyLog
    : (f: (s: string) => void) => (s: string) => <T>(_: T) => T
    = f => s => state => {
    f(s)
    return state
}

type Ok<T> = readonly['ok', T]

type Error<E> = readonly['error', E]

type Result<T, E> = Ok<T>|Error<E>

const tryCatch
    : <T>(f: () => T) => Result<T, unknown>
    = f => {
    // `try catch` is not allowed in FunctionalScript.
    try {
        return ['ok', f()]
    } catch (e) {
        return ['error', e]
    }
}

const measure
    : <R>(f: () => R) => <T>(state: T) => readonly[R, number, T]
    = f => state => {
    const b = performance.now()
    const r = f()
    const e = performance.now()
    return [r, e - b, state]
}

// test runner.
const main = async() => {
    const moduleMap = await loadModuleMap()

    const r = test({
        moduleMap,
        log: anyLog(console.log),
        error: anyLog(console.error),
        measure,
        tryCatch,
        env,
        state: void 0,
    })
    exit(r[0])
}

main()
