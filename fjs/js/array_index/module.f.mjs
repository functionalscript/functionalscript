/**
 * The ECMAScript array-index rule — one source of truth.
 *
 * Every consumer that asks whether a property key names an element — the
 * RTTI readers, the compiler's literal folding — asks {@link arrayIndex}
 * instead of keeping a copy, so the bound cannot drift apart between them.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { isUintUpTo } from '../../types/number/module.f.mjs'

const isIndexValue = isUintUpTo(2 ** 32 - 2)

/**
 * The array index a property key names, or `null`: the canonical decimal
 * spelling of an integer in `0 .. 2 ** 32 - 2`
 * ([ECMA-262 §6.1.7](https://tc39.es/ecma262/#array-index)). `'-1'`, `'01'`,
 * `'1.5'`, `'1e3'`, `' 1'`, `'-0'` and `'4294967295'` are ordinary properties.
 *
 * Round-tripping the number back through `String` is the test: it *is*
 * `Number::toString`, run by the engine that defines it, so it rejects every
 * non-canonical spelling at once rather than one at a time.
 *
 * The upper bound is the language's, not one chosen here: assigning
 * `a['4294967295']` creates an ordinary enumerable property and leaves
 * `a.length` alone. Reading such a key as an index puts it past every
 * `length`-bounded walk *and* past a non-index filter, so it is no member on
 * either path — which is how an undeclared property once rode through a
 * closed RTTI container.
 *
 * @type {(key: string) => Nullable<number>}
 */
export const arrayIndex = key => {
    const i = Number(key)
    return isIndexValue(i) && String(i) === key ? i : null
}
