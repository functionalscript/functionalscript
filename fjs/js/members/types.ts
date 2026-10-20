/**
 * Type-level API for `fjs/js/members/module.f.js`: the shape of the
 * table, which keeps it complete — every type's keys are exactly the
 * names its prototype has and `allowedCalls` admits, a key added or
 * missing failing `tsc` at the value — and every entry a function of the
 * receiver, typed as that type, and the arguments, which is the type a
 * consumer calls an entry through, `todo` or not. A compile-time claim
 * about exports lives here, at module scope, where `tsc` checks it
 * whatever a proof body does.
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
import type { members } from './module.f.js'

/**
 * A member function of a type: the receiver, typed as the type it is
 * under, and the arguments as the call passed them.
 */
export type TypeMemberFunc<T> = (self: T, ...args: readonly unknown[]) => unknown

/** A type's members: each of the names `K`, then its function. */
export type TypeMembers<T, K extends string> = {
    readonly [k in K]: TypeMemberFunc<T>
}

/** An array receiver: any items, never written. */
export type AnyArray = readonly unknown[]

/** The names a type's prototype has that a module may call. */
export type Admitted<P extends readonly string[]> = Extract<P[number], AllowedCall>

/**
 * The table: a type, then its members, exactly the admitted names of the
 * type's prototype. The value is declared as this type, so an entry is
 * callable as `(self, ...args)` wherever it is imported, and a key the
 * prototype lacks, or one it has and the value lacks, is a type error at
 * the value.
 */
export type Members = {
    readonly boolean: TypeMembers<boolean, Admitted<typeof booleanPrototype>>
    readonly string: TypeMembers<string, Admitted<typeof stringPrototype>>
    readonly number: TypeMembers<number, Admitted<typeof numberPrototype>>
    readonly bigint: TypeMembers<bigint, Admitted<typeof bigintPrototype>>
    readonly object: TypeMembers<object, Admitted<typeof objectPrototype>>
    readonly array: TypeMembers<AnyArray, Admitted<typeof arrayPrototype>>
    readonly function: TypeMembers<Function, Admitted<typeof functionPrototype>>
}

/** The exported value is the table, the seven types and nothing else. */
type _Members = Assert<Equal<typeof members, Members>>
