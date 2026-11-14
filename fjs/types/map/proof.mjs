/**
 * Host-only key admission: symbols are outside FunctionalScript's value
 * domain. Distinct symbols with equal descriptions must be refused instead
 * of being collapsed by the primitive index's string encoding.
 */
import { empty, mapDelete, mapGet, mapHas, mapSet } from './module.f.js'

const key = Symbol('same description')
const other = Symbol('same description')

export const proof = /** @type {const} */ ({
    throw: {
        setSymbol: () => { mapSet(empty, key, 1) },
        setOtherSymbol: () => { mapSet(empty, other, 2) },
        getSymbol: () => { mapGet(empty, key) },
        hasSymbol: () => { mapHas(empty, key) },
        deleteSymbol: () => { mapDelete(empty, key) },
    },
})
