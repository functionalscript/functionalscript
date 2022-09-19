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

/** @type {<T>(input: Input<T>) => T} */
const main = ({moduleMap, log, state}) => {
    /** @typedef {log extends Log<infer T> ? T : never} T */
    /** @type {(i: string) => (v: unknown) => (state: T) => T} */
    const test = i => v => state => {
        switch (typeof v) {
            case 'function': {
                if (v.length === 0) {
                    const r = v()
                    state = log(`${i}() passed`)(state)
                    state = test(`${i}| `)(r)(state)
                }
                break
            }
            case 'object': {
                if (v instanceof Array) {
                    for (const v2 of v) {
                        state = test(`${i}| `)(v2)(state)
                    }
                } else if (v !== null) {
                    for (const [k, v2] of Object.entries(v)) {
                        state = log(`${i}${k}:`)(state)
                        state = test(`${i}| `)(v2)(state)
                    }
                }
                break
            }
        }
        return state
    }
    for (const [k, v] of Object.entries(moduleMap)) {
        if (k.endsWith('test.f.cjs')) {
            state = log(`testing ${k}`)(state)
            state = test('| ')(v.exports)(state)
        }
    }
    return state
}

module.exports = main