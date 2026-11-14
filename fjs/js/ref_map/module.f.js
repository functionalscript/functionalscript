/**
 * The reference map as the runtime defines it
 * ([reference map](../../../spec/built-ins/reference-map/README.md)): the body an executor
 * with no map of its own answers the EDAG's `['refMap']` with, written in
 * FunctionalScript alone, as the runtime's other bodies are. It keeps the
 * contract of [`fjs/types/ref_map`](../../types/ref_map/module.f.js) in
 * its shortest form, a list of pairs searched with `===`, so every answer
 * is the same and only the bound is not: a call takes `O(n)` steps here,
 * where the contract asks `O(log n)`
 * ([shared store](../../edag/todo/reference-map-store.md)).
 *
 * A map made here is an ordinary function of ordinary values, so an
 * executor needs no value of its own for it: it is called, compared,
 * written out and converted to its text as every function is.
 *
 * @module
 *
 * @import { RefMap, RefMapKey } from '../../types/ref_map/types.ts'
 * @import { _Pairs } from './private.ts'
 */

/** The value the newest pair for `key` holds, or `undefined`. @type {(pairs: _Pairs, key: RefMapKey) => unknown} */
const find = (pairs, key) => {
    let rest = pairs
    while (rest !== undefined) {
        if (rest[0] === key) { return rest[1] }
        rest = rest[2]
    }
    return undefined
}

/** The map holding `pairs`. @type {(pairs: _Pairs) => RefMap} */
const make = pairs => {
    /** @type {RefMap} */
    const self = (key, value) => {
        const old = find(pairs, key)
        if (value === undefined) { return [old, self] }
        // a primitive is never a key: none is ever found, and setting one fails
        if (key === null || typeof key !== 'object' && typeof key !== 'function') { throw 'a reference map key is an object or a function' }
        return [old, make([key, value, pairs])]
    }
    return self
}

/**
 * A new empty map. Each call answers a map of its own, which an executor
 * asks for wherever the node is established, as it makes a function
 * wherever a `=>` is.
 *
 * @type {() => RefMap}
 */
export const refMap = () => make(undefined)
