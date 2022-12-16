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
 * @typedef {readonly[number, T]} State
 */

/** @type {<T>(input: Input<T>) => T} */
const main = input => {
    let { moduleMap, log, performanceNow, state } = input
    /** @typedef {input extends Input<infer T> ? T : never} T */
    /** @type {(i: string) => (v: unknown) => (state: State<T>) => State<T>} */
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
                /** @type {(k: readonly[string|number, unknown]) => (state: State<T>) => State<T>} */
                const f = ([k, v]) => ([time, state]) => {
                    state = log(`${i}${k}:`)(state);
                    [time, state] = next(v)([time, state])
                    return [time, state]
                }
                const foldF = fold(f)([time, state])
                if (v instanceof Array) {
                    [time, state] = foldF(list.entries(v))
                } else if (v !== null) {
                    [time, state] = foldF(Object.entries(v))
                }
                break
            }
        }
        return [time, state]
    }
    const next = test('| ')
    /** @type {(k: readonly[string, Module]) => (fs: State<T>) => State<T>} */
    const f = ([k, v]) => ([time, state]) => {
        if (isTest(k)) {
            state = log(`testing ${k}`)(state);
            [time, state] = next(v.exports)([time, state])
        }
        return [time, state]
    }
    /** @type {State<T>} */
    const init = [0, state]
    let time = 0;
    [time, state] = fold(f)(init)(Object.entries(moduleMap))
    state = log(`total ${time} ms`)(state);
    return state
}

module.exports = main