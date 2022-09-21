const list = require('../../types/list/module.f.cjs')
const { fold } = list

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
 * @typedef {{
 *  readonly moduleMap: ModuleMap,
 *  readonly log: Log<T>,
 *  readonly state: T,
 * }} Input
 */

/**
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
 *
 * @type {(c: number) => string}
 */
const sgr = c => `\x1b[${c.toString()}m`

const reset = sgr(0)

const fgGreen = sgr(32)

/** @type {(s: string) => boolean} */
const isTest = s => s.endsWith('test.f.cjs')

/** @type {<T>(input: Input<T>) => T} */
const main = ({moduleMap, log, state}) => {
    /** @typedef {log extends Log<infer T> ? T : never} T */
    /** @type {(i: string) => (v: unknown) => (state: T) => T} */
    const test = i => v => state => {
        const next = test(`${i}| `)
        switch (typeof v) {
            case 'function': {
                if (v.length === 0) {
                    const r = v()
                    state = log(`${i}() ${fgGreen}ok${reset}`)(state)
                    state = next(r)(state)
                }
                break
            }
            case 'object': {
                /** @type {(k: readonly[string|number, unknown]) => (state: T) => T} */
                const f = ([k, v]) => state => {
                    state = log(`${i}${k}:`)(state)
                    state = next(v)(state)
                    return state
                }
                const foldF = fold(f)(state)
                if (v instanceof Array) {
                    state = foldF(list.entries(v))
                } else if (v !== null) {
                    state = foldF(Object.entries(v))
                }
                break
            }
        }
        return state
    }
    const next = test('| ')
    /** @type {(k: readonly[string, Module]) => (state: T) => T} */
    const f = ([k, v]) => state => {
        if (isTest(k)) {
            state = log(`testing ${k}`)(state)
            state = next(v.exports)(state)
        }
        return state
    }
    return fold(f)(state)(Object.entries(moduleMap))
}

module.exports = main