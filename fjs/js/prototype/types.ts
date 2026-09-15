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
    arrayPrototype,
    bigintPrototype,
    booleanPrototype,
    functionPrototype,
    numberPrototype,
    objectPrototype,
    prototypeNames,
    stringPrototype,
} from './module.f.mjs'

/** Every name a built-in prototype gives a value. */
export type PrototypeName = (typeof prototypeNames)[number]

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
