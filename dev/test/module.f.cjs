const list = require('../../types/list/module.f.cjs')
const { fold } = list
const { reset, fgGreen } = require('../../text/sgr/module.f.cjs')

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
 * }} Input
 */

/** @type {(s: string) => boolean} */
const isTest = s => s.endsWith('test.f.cjs')

/**
 * @template T
 * @typedef {readonly[number, T]} FullState
 */

/** @type {<T>(input: Input<T>) => T} */
const main = input => {
    let { moduleMap, log, performanceNow, state } = input
    /** @typedef {input extends Input<infer T> ? T : never} T */
    /** @type {(i: string) => (v: unknown) => (fs: FullState<T>) => FullState<T>} */
    const test = i => v => ([time, state]) => {
        const next = test(`${i}| `)
        switch (typeof v) {
            case 'function': {
                if (v.length === 0) {
                    let b = 0;
                    [b, state] = performanceNow(state)
                    const r = v()
                    let e = 0;
                    [e, state] = performanceNow(state)
                    const delta = e - b
                    time += delta
                    state = log(`${i}() ${fgGreen}ok${reset}, ${delta} ms`)(state);
                    [time, state] = next(r)([time, state])
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
                    [time, state] = fold
                        (f)
                        ([time, state])
                        (v instanceof Array ? list.entries(v) : Object.entries(v))
                }
                break
            }
        }
        return [time, state]
    }
    const next = test('| ')
    /** @type {(k: readonly[string, Module]) => (fs: FullState<T>) => FullState<T>} */
    const f = ([k, v]) => ([time, state]) => {
        if (isTest(k)) {
            state = log(`testing ${k}`)(state);
            [time, state] = next(v.exports)([time, state])
        }
        return [time, state]
    }
    let time = 0;
    [time, state] = fold(f)([time, state])(Object.entries(moduleMap))
    state = log(`total ${time} ms`)(state);
    return state
}

module.exports = main