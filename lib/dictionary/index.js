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

/**
 * @template T
 * @typedef {[N<T>, T, N<T>, T, N<T>, T, N<T>]} N7
 */

/** @type {<T>(n: N7<T>) => N3<T>} */
const split = ([n0, v01, n1, v12, n2, v23, n3]) => [[n0, v01, n1], v12, [n2, v23, n3]]

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
    /** 
     * @type {(asOverflow: (overflow: N3<T>) => Result<T>) => 
     *  (asReplace: (replace: N<T>) => N<T>) => 
     *  (node: N<T>) => 
     *  Result<T>} 
     */
    const merge = asOverflow => asReplace => node => {
        const result = f(node)
        if ('found' in result) { return result }
        if ('replace' in result) { return { replace: asReplace(result.replace) } }
        return asOverflow(result.overflow)
    }
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
                    case 0: return { found: v1 }
                    default: return { overflow: [[v0], v1, [value]]}
                }                
            }
            case 3: {
                const [n0, v01, n1] = n
                /** 
                 * @type {(asOverflow: (overflow: N3<T>) => N5<T>) => 
                 *  (asReplace: (replace: N<T>) => N3<T>) => 
                 *  (node: N<T>) => 
                 *  Result<T>} 
                 */
                const merge2 = asOverflow => merge(overflow => ({ replace: asOverflow(overflow) }))
                switch (cmp(v01)) {
                    case -1: return merge2                        
                        (overflow => [...overflow, v01, n1])
                        (replace => [replace, v01, n1])
                        (n0)
                    case 0: return { found: v01 }
                    default: return merge2                        
                        (overflow => [n0, v01, ...overflow])
                        (replace => [n0, v01, replace])
                        (n1)
                }
            }
        }
        const [n0, v01, n1, v12, n2] = n
        /** 
         * @type {(asOverflow: (overflow: N3<T>) => N7<T>) => 
         *  (asReplace: (replace: N<T>) => N5<T>) => 
         *  (node: N<T>) => 
         *  Result<T>} 
         */
        const merge3 = asOverflow => merge(overflow => ({ overflow: split(asOverflow(overflow)) }))
        switch (cmp(v01)) {
            case -1: return merge3                
                (overflow => [...overflow, v01, n1, v12, n2])
                (replace => [replace, v01, n1, v12, n2])
                (n0)
            case 0: return { found: v01 }
        }
        switch (cmp(v12)) {
            case -1: return merge3
                (overflow => [n0, v01, ...overflow, v12, n2])
                (replace => [n0, v01, replace, v12, n2])
                (n1)
            case 0: return { found: v12 }
            default: return merge3
                (overflow => [n0, v01, n1, v12, ...overflow])
                (replace => [n0, v01, n1, v12, replace])
                (n2)
        }        
    }
    return f
}