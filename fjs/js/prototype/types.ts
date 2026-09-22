/**
 * Type-level API for `fjs/js/prototype/module.f.mjs`: the pin that
 * `prototypeNames` is exactly the union of the seven prototypes' lists.
 * A compile-time claim about exports lives here, at module scope, where
 * `tsc` checks it whatever a proof body does.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type {
    allowedCalls,
    arrayPrototype,
    bigintPrototype,
    booleanPrototype,
    functionPrototype,
    numberPrototype,
    objectPrototype,
    prohibitedCalls,
    prototypeNames,
    stringPrototype,
} from './module.f.mjs'

/** Every name a built-in prototype gives a value. */
export type PrototypeName = (typeof prototypeNames)[number]

/** A prototype name a module may not call as a member function. */
export type ProhibitedCall = (typeof prohibitedCalls)[number]

/** A prototype name a module may call as a member function. */
export type AllowedCall = (typeof allowedCalls)[number]

/**
 * The two call lists and `length` partition the prototype names: their
 * union is every name, and no two share one. `length` is on neither list,
 * a value owning it.
 */
type _CallsPartition = Assert<Equal<ProhibitedCall | AllowedCall | 'length', PrototypeName>>
type _CallsDisjoint = Assert<Equal<ProhibitedCall & AllowedCall, never>>
type _LengthOnNeither = Assert<Equal<Extract<ProhibitedCall | AllowedCall, 'length'>, never>>

type _NamesPinned = Assert<Equal<
    PrototypeName,
    | (typeof objectPrototype)[number]
    | (typeof arrayPrototype)[number]
    | (typeof stringPrototype)[number]
    | (typeof numberPrototype)[number]
    | (typeof booleanPrototype)[number]
    | (typeof bigintPrototype)[number]
    | (typeof functionPrototype)[number]
>>
