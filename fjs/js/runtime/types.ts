/**
 * Type-level API for `fjs/js/runtime/module.f.js`: the pins that keep the
 * table inside the admitted set — every type it keys is a receiver type,
 * every key under a type is a name `allowedCalls` admits on that type's
 * prototype — and every entry a body. A compile-time claim about exports
 * lives here, at module scope, where `tsc` checks it whatever a proof body
 * does.
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

/** The table: a receiver type, then a member name, then its body. */
export type Runtime = typeof runtime

/** A receiver type the table keys. */
export type ReceiverType = keyof Runtime

/**
 * A body: a function of the receiver and then the arguments as the call
 * passed them. Each body narrows the parameters to what its name reads.
 */
export type Body = (self: never, ...args: never[]) => unknown

/** The prototype each receiver type's names come from, by the name `fjs/nanvm/methods` uses. */
type Prototypes = {
    readonly object: typeof objectPrototype
    readonly array: typeof arrayPrototype
    readonly string: typeof stringPrototype
    readonly number: typeof numberPrototype
    readonly boolean: typeof booleanPrototype
    readonly bigint: typeof bigintPrototype
    readonly function: typeof functionPrototype
}

/** The names `allowedCalls` admits on a prototype. */
type Admitted<P extends readonly string[]> = Extract<AllowedCall, P[number]>

type _Types = Assert<Equal<ReceiverType extends keyof Prototypes ? true : false, true>>

/** Whether every key of every type is an allowed name on that type's prototype. */
type _KeysAdmitted = { readonly [T in ReceiverType]: keyof Runtime[T] extends Admitted<Prototypes[T]> ? true : false }[ReceiverType]

type _Keys = Assert<Equal<_KeysAdmitted, true>>

/** Every entry of every type. */
type Entry = { readonly [T in ReceiverType]: Runtime[T][keyof Runtime[T]] }[ReceiverType]

type _Entries = Assert<Equal<Entry extends Body ? true : false, true>>
