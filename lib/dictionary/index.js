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
const split = ([n0, v0, n1, v1, n2, v2, n3]) => [[n0, v0, n1], v1, [n2, v2, n3]]

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/**
 * @template T
 * @typedef {{ done: T|undefined } | { replace: N<T> } | { overflow: N3<T> }} Result<T>
 */

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (node: N<T>) => Result<T>} */
const insert = cmp => value => {
    /** @typedef {typeof value} T */
    /** 
     * @type {(overflow: (o: N3<T>) => Result<T>) => 
     *  (replace: (r: N<T>) => N<T>) => 
     *  (node: N<T>) => 
     *  Result<T>} 
     */
    const merge = overflow => replace => node => {
        const result = f(node)
        if ('done' in result) { return result }
        if ('replace' in result) { return { replace: replace(result.replace) } }
        return overflow(result.overflow)
    }
    /** @type {(n: N<T>) => Result<T>} */
    const f = node => {    
        switch (node.length) {
            case 1: {
                const [v] = node
                switch (cmp(v)) {
                    case -1: return { replace: [value, v] }
                    case 1: return { replace: [v, value] }           
                }                
                return { done: v } 
            }
            case 2: {
                const [v0, v1] = node
                switch (cmp(v0)) {                    
                    case -1: return { overflow: [[value], v0, [v1]] }                    
                    case 0: return { done: v0 }
                }
                switch (cmp(v1)) {
                    case -1: return { overflow: [[v0], value, [v1]] }
                    case 0: return { done: v1 }
                    default: return { overflow: [[v0], v1, [value]]}
                }                
            }
            case 3: {
                const [n0, v0, n1] = node
                /** 
                 * @type {(overflow: (o: N3<T>) => N5<T>) => 
                 *  (replace: (r: N<T>) => N3<T>) => 
                 *  (node: N<T>) => 
                 *  Result<T>} 
                 */
                const merge2 = overflow => merge(o => ({ replace: overflow(o) }))
                switch (cmp(v0)) {
                    case -1: return merge2                        
                        (o => [...o, v0, n1])
                        (r => [r, v0, n1])
                        (n0)
                    case 0: return { done: v0 }
                    default: return merge2                        
                        (o => [n0, v0, ...o])
                        (r => [n0, v0, r])
                        (n1)
                }
            }
        }
        const [n0, v0, n1, v1, n2] = node
        /** 
         * @type {(overflow: (o: N3<T>) => N7<T>) => 
         *  (replace: (r: N<T>) => N5<T>) => 
         *  (node: N<T>) => 
         *  Result<T>} 
         */
        const merge3 = overflow => merge(o => ({ overflow: split(overflow(o)) }))
        switch (cmp(v0)) {
            case -1: return merge3                
                (o => [...o, v0, n1, v1, n2])
                (r => [r, v0, n1, v1, n2])
                (n0)
            case 0: return { done: v0 }
        }
        switch (cmp(v1)) {
            case -1: return merge3
                (o => [n0, v0, ...o, v1, n2])
                (r => [n0, v0, r, v1, n2])
                (n1)
            case 0: return { done: v1 }
            default: return merge3
                (o => [n0, v0, n1, v1, ...o])
                (r => [n0, v0, n1, v1, r])
                (n2)
        }        
    }
    return f
}