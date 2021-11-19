const { todo } = require('..')

/**
 * @template T
 * @typedef {{ 
 *  readonly get: (_: string) => T|undefined
 *  readonly set: (_: string) => (_: T) => Dictionary<T> 
 *  readonly entries: () => Iterable<readonly [string, T]>
 * }} Dictionary
 */

/**
 * @template T
 * @typedef {readonly [T]} V1
 */

/**
 * @template T
 * @typedef {readonly [T, T]} V2
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>]} N3
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>, T, N<T>]} N5
 */

/**
 * @template T
 * @typedef {V1<T> | V2<T> | N3<T> | N5<T>} N
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>, T, N<T>, T, N<T>]} N7
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
 * @typedef {readonly [T, T]} Array2
 */

/**
 * @template T
 * @typedef {readonly [T, T, T]} Array3
 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T, T]} Array5
 */

/** @typedef {0|1|2|3|4} Index5 */

/** @type {<T>(cmp: Cmp<T>) => (v2: V2<T>) => Index5} */
const index5 = cmp => ([v0, v1]) => {
    const c = cmp(v0)
    if (c <= 0) { return /** @type {Index5} */ (c + 1) }
    return /** @type {Index5} */ (cmp(v1) + 3)
}

/** 
 * @template T
 * @template R
 * @typedef {{
 *  done: (_: T) => R
 *  v1: Array2<(_: T) => R>
 *  v2: Array3<(_: V2<T>) => (_: R) => R>
 *  n3: Array2<(_: N3<T>) => (_: R) => R>
 *  n5: Array3<(_: N5<T>) => (_: R) => R>
 * }} Visitor
 */

/**
 * @template T
 * @typedef {{ done: T|undefined } | { replace: N<T> } | { overflow: N3<T> }} Result<T>
 */

/** 
 * @type {<T>(overflow: (o: N3<T>) => Result<T>) => 
 *  (replace: (r: N<T>) => N<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge = overflow => replace => result => {
    if ('done' in result) { return result }
    if ('replace' in result) { return { replace: replace(result.replace) } }
    return overflow(result.overflow)
}

/** 
 * @type {<T>(overflow: (o: N3<T>) => N5<T>) => 
 *  (replace: (r: N<T>) => N3<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge2 = overflow => merge(o => ({ replace: overflow(o) }))

/** 
 * @type {<T>(overflow: (o: N3<T>) => N7<T>) => 
 *  (replace: (r: N<T>) => N5<T>) => 
 *  (result: Result<T>) => 
 *  Result<T>} 
 */
const merge3 = overflow => merge(o => ({ overflow: split(overflow(o)) }))

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (node: N<T>) => Result<T>} */
const insert = cmp => value => {
    /** @typedef {typeof value} T */
    /** @type {(n: N<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: {
                const [v] = node
                switch (cmp(v)) {
                    case -1: return { replace: [value, v] }
                    case 0: return { done: v }
                    default: return { replace: [v, value] }
                }                
            }
            case 2: {
                const [v0, v1] = node
                switch (index5(cmp)(node)) {
                    case 0: return { overflow: [[value], v0, [v1]] }
                    case 1: return { done: v0 }
                    case 2: return { overflow: [[v0], value, [v1]] }
                    case 4: return { done: v1 }
                    default: return { overflow: [[v0], v1, [value]] }
                }
            }
            case 3: {
                const [n0, v0, n1] = node
                switch (cmp(v0)) {
                    case -1: return merge2
                        (o => [...o, v0, n1])
                        (r => [r, v0, n1])
                        (f(n0))
                    case 0: return { done: v0 }
                    default: return merge2
                        (o => [n0, v0, ...o])
                        (r => [n0, v0, r])
                        (f(n1))
                }
            }
            default: {
                const [n0, v0, n1, v1, n2] = node
                switch (index5(cmp)([v0, v1])) {
                    case 0: return merge3
                        (o => [...o, v0, n1, v1, n2])
                        (r => [r, v0, n1, v1, n2])
                        (f(n0))
                    case 1: return { done: v0 }
                    case 2: return merge3
                        (o => [n0, v0, ...o, v1, n2])
                        (r => [n0, v0, r, v1, n2])
                        (f(n1))
                    case 3: return { done: v1 }
                    default: return merge3
                        (o => [n0, v0, n1, v1, ...o])
                        (r => [n0, v0, n1, v1, r])
                        (f(n2))
                }
            }
        }
    }
    return f
}

/** @type {<T>(cmp: Cmp<T>) => (node: N<T>) => T|undefined} */
const search = cmp => {
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T */
    /** @type {(n: N<T>) => T|undefined} */
    const f = node => {
        switch (node.length) {
            case 1: {
                const [v] = node
                return cmp(v) === 0 ? v : undefined
            }
            case 2: {
                switch (index5(cmp)(node)) {
                    case 1: return node[0]
                    case 3: return node[1]
                    default: return undefined
                }
            }
            case 3: {
                const [n0, v0, n1] = node
                switch (cmp(v0)) {
                    case -1: return f(n0)
                    case 0: return v0
                    default: return f(n1)
                }
            }
            default: {
                const [n0, v0, n1, v1, n2] = node
                switch (index5(cmp)([v0, v1])) {
                    case 0: return f(n0)
                    case 1: return v0
                    case 2: return f(n1)
                    case 3: return v1
                    default: return f(n2)
                }
            }
        }
    }
    return f
}
