const list = require('../../types/list/module.f.cjs')
const { fold } = list
const { reset, fgGreen, fgRed, bold } = require('../../text/sgr/module.f.cjs')
const result = require('../../types/result/module.f.cjs')

/**
 * @typedef {{
 *  readonly[k in string]?: Module
 * }} DependencyMap
 */

/**
 * @typedef {{
 *  readonly dependencyMap: DependencyMap
 *  readonly exports?: unknown
 * }} Module
 */

/**
 * @typedef {{
 *  readonly[k in string]: Module
 * }} ModuleMap
 */

/**
 * @template T
 * @typedef {(v: string) => (state: T) => T} Log
 */

/**
 * @template T
 * @typedef {(state: T) => readonly[number, T]} PerformanceNow
 */

/**
 * @template T
 * @typedef {{
 *  readonly moduleMap: ModuleMap,
 *  readonly log: Log<T>,
 *  readonly performanceNow: PerformanceNow<T>,
 *  readonly state: T,
 *  readonly tryCatch: <R>(f: () => R) => result.Result<R, unknown>
 * }} Input
 */

/** @type {(s: string) => boolean} */
const isTest = s => s.endsWith('test.f.cjs')

/**
 * @typedef {{
 *  readonly time: number,
 *  readonly pass: number,
 *  readonly fail: number,
 * }} TestState
 */

/** @type {(time: number) => (testState: TestState) => TestState} */
const addPass = delta => ts => ({ ...ts, time: ts.time + delta, pass: ts.pass + 1 })

/** @type {(time: number) => (testState: TestState) => TestState} */
const addFail = delta => ts => ({ ...ts, time: ts.time + delta, fail: ts.fail + 1 })

/**
 * @template T
 * @typedef {readonly[TestState, T]} FullState
 */

/** @type {<T>(input: Input<T>) => readonly[number, T]} */
const main = input => {
    let { moduleMap, log, performanceNow, state, tryCatch } = input
    /** @typedef {input extends Input<infer T> ? T : never} T */
    /** @type {(i: string) => (v: unknown) => (fs: FullState<T>) => FullState<T>} */
    const test = i => v => ([ts, state]) => {
        const next = test(`${i}| `)
        switch (typeof v) {
            case 'function': {
                if (v.length === 0) {
                    let b = 0;
                    [b, state] = performanceNow(state)
                    const [s, r] = tryCatch(/** @type {() => unknown} */(v))
                    let e = 0;
                    [e, state] = performanceNow(state)
                    const delta = e - b
                    if (s === 'error') {
                        ts = addFail(delta)(ts)
                        state = log(`${i}() ${fgRed}error${reset}, ${delta} ms`)(state)
                        state = log(`${fgRed}${r}${reset}`)(state)
                    } else {
                        ts = addPass(delta)(ts)
                        state = log(`${i}() ${fgGreen}ok${reset}, ${delta} ms`)(state)
                    }
                    [ts, state] = next(r)([ts, state])
                }
                break
            }
            case 'object': {
                if (v !== null) {
                    /** @type {(k: readonly[string|number, unknown]) => (fs: FullState<T>) => FullState<T>} */
                    const f = ([k, v]) => ([time, state]) => {
                        state = log(`${i}${k}:`)(state);
                        [time, state] = next(v)([time, state])
                        return [time, state]
                    }
                    [ts, state] = fold
                        (f)
                        ([ts, state])
                        (v instanceof Array ? list.entries(v) : Object.entries(v))
                }
                break
            }
        }
        return [ts, state]
    }
    const next = test('| ')
    /** @type {(k: readonly[string, Module]) => (fs: FullState<T>) => FullState<T>} */
    const f = ([k, v]) => ([ts, state]) => {
        if (isTest(k)) {
            state = log(`testing ${k}`)(state);
            [ts, state] = next(v.exports)([ts, state])
        }
        return [ts, state]
    }
    /** @type {TestState} */
    let ts = { time: 0, pass: 0, fail: 0 };
    [ts, state] = fold(f)([ts, state])(Object.entries(moduleMap))
    state = log(`${bold}Number of tests: pass: ${ts.pass}, fail: ${ts.fail}, total: ${ts.pass + ts.fail}${reset}`)(state)
    state = log(`${bold}Time: ${ts.time} ms${reset}`)(state);
    return [ts.fail !== 0 ? 1 : 0, state]
}

module.exports = main
