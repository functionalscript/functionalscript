const { todo } = require('../')

/**
 * @template T
 * @typedef {{ 
 *  readonly get: (_: string) => T|undefined
 *  readonly set: (_: string) => (_: T) => Dictionary<T> 
 *  readonly entries: () => Iterable<[string, T]>
 * }} Dictionary
 */

/**
 * @template T
 * @typedef {[T]} V1
 */

/**
 * @template T
 * @typedef {[T, T]} V2
 */

/**
 * @template T
 * @typedef {[N<T>, T, N<T>]} N3
 */

/**
 * @template T
 * @typedef {[N<T>, T, N<T>, T, N<T>]} N5
 */

/**
 * @template T
 * @typedef {V1<T> | V2<T> | N3<T> | N5<T>} N
 */

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/**
 * @template T
 * @typedef {{ found: T } | { replace: N<T> } | { overflow: N3<T> }} Result<T>
 */

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (node: N<T>) => Result<T>} */
const insert = cmp => value => {
    /** @typedef {typeof value} T */
    /** @type {(n: N<T>) => Result<T>} */
    const f = n => {    
        switch (n.length) {
            case 1: {
                const [v] = n
                switch (cmp(v)) {
                    case -1: return { replace: [value, v] }
                    case 1: return { replace: [v, value] }           
                }                
                return { found: v } 
            }
            case 2: {
                const [v0, v1] = n
                switch (cmp(v0)) {
                    case -1: return { overflow: [[value], v0, [v1]] }
                    case 0: return { found: v0 }
                }
                switch (cmp(v1)) {
                    case -1: return { overflow: [[v0], value, [v1]] }
                    case 1: return { overflow: [[v0], v1, [value]]}                    
                }
                return { found: v1 }
            }
            case 3: {
                const [n0, v01, n1] = n
                switch (cmp(v01)) {
                    case -1: {
                        const result = f(n0)
                        if ('found' in result) { return result }
                        if ('replace' in result) { return { replace: [result.replace, v01, n1] } }
                        return { replace: [...result.overflow, v01, n1] }
                    }
                    case 1: {
                        const result = f(n1)
                        if ('found' in result) { return result }
                        if ('replace' in result) { return { replace: [n0, v01, result.replace] } }
                        return { replace: [n0, v01, ...result.overflow] }
                    }
                }
                return { found: v01 }
            }
        }
        const [n0, v01, n1, v12, n2] = n
        /** @type {(asReplace: (replace: N<T>) => N5<T>) => (asOverflow: (overflow: N3<T>) => N3<T>) => (node: N<T>) => Result<T>} */
        const merge = asReplace => asOverflow => node => {
            const result = f(node)
            if ('found' in result) { return result }
            if ('replace' in result) { return { replace: asReplace(result.replace) } }
            return { overflow: asOverflow(result.overflow) }
        }
        switch (cmp(v01)) {
            case -1: return merge
                (replace => [replace, v01, n1, v12, n2])
                (overflow => [overflow, v01, [n1, v12, n2]])
                (n0)
            case 0: return { found: v01 }
        }
        switch (cmp(v12)) {
            case -1: return merge
                (replace => [n0, v01, replace, v12, n2])
                (([n10, v101, n11]) => [[n0, v01, n10], v101, [n11, v12, n2]])
                (n1)
            case 1: merge
                (replace => [n0, v01, n1, v12, replace])
                (overflow => [[n0, v01, n1], v12, overflow])
                (n2)
        }
        return { found: v12 }
    }
    return f
}