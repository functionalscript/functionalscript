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
 * @typedef {{
 *  readonly moduleMap: ModuleMap,
 *  readonly log: (v: string) => void,
 * }} Input
 */

/** @type {(input: Input) => void} */
const main = ({moduleMap, log}) => {
    /** @type {(i: string) => (v: unknown) => void} */
    const test = i => v => {
        switch (typeof v) {
            case 'function': {
                if (v.length === 0) {
                    const r = v()
                    log(`${i}() passed`)
                    test(`${i}| `)(r)
                }
                return;
            }
            case 'object': {
                if (v instanceof Array) {
                    for (const v2 of v) {
                        test(`${i}| `)(v2)
                    }
                } else if (v !== null) {
                    for (const [k, v2] of Object.entries(v)) {
                        log(`${i}${k}:`)
                        test(`${i}| `)(v2)
                    }
                }
                return;
            }
        }
    }
    for (const [k, v] of Object.entries(moduleMap)) {
        if (k.endsWith('test.f.cjs')) {
            log(`testing ${k}`)
            test('| ')(v.exports)
        }
    }
}

module.exports = main