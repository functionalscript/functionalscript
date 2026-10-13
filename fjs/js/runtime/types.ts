/**
 * Type-level API for `fjs/js/runtime/module.f.js`: the pins that keep the
 * table the admitted set — each type's keys are exactly the names
 * `allowedCalls` admits on that type's prototype — and every entry a body
 * or the marker. A compile-time claim about exports lives here, at module
 * scope, where `tsc` checks it whatever a proof body does.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { AllowedCall } from '../prototype/types.ts'
import type {
    arrayPrototype,
    bigintPrototype,
    booleanPrototype,
    functionPrototype,
    numberPrototype,
    objectPrototype,
    stringPrototype,
} from '../prototype/module.f.js'
import type { runtime } from './module.f.js'

/** The table: a receiver type, then a member name, then its entry. */
export type Runtime = typeof runtime

/** A receiver type the table keys, the seven of `fjs/nanvm/methods`. */
export type ReceiverType = keyof Runtime

/** The marker of a name every VM binds itself. */
export type Native = 'native'

/**
 * A body: a function of the receiver and then the arguments as the call
 * passed them. Each body narrows the parameters to what its name reads.
 */
export type Body = (self: never, ...args: never[]) => unknown

/** Every entry of every type. */
type Entry = { readonly [T in ReceiverType]: Runtime[T][keyof Runtime[T]] }[ReceiverType]

type _Entries = Assert<Equal<Entry extends Native | Body ? true : false, true>>

/** The names `allowedCalls` admits on a prototype. */
type Admitted<P extends readonly string[]> = Extract<AllowedCall, P[number]>

type _Object = Assert<Equal<keyof Runtime['object'], Admitted<typeof objectPrototype>>>
type _Array = Assert<Equal<keyof Runtime['array'], Admitted<typeof arrayPrototype>>>
type _String = Assert<Equal<keyof Runtime['string'], Admitted<typeof stringPrototype>>>
type _Number = Assert<Equal<keyof Runtime['number'], Admitted<typeof numberPrototype>>>
type _Boolean = Assert<Equal<keyof Runtime['boolean'], Admitted<typeof booleanPrototype>>>
type _Bigint = Assert<Equal<keyof Runtime['bigint'], Admitted<typeof bigintPrototype>>>
type _Function = Assert<Equal<keyof Runtime['function'], Admitted<typeof functionPrototype>>>
