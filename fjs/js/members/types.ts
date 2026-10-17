/**
 * Type-level API for `fjs/js/members/module.f.mjs`: the shape of the
 * table, and the pins that keep it complete — every type's keys are
 * exactly the names its prototype has and `allowedCalls` admits, and
 * every entry is a function of the receiver, typed as that type, and the
 * arguments. A compile-time claim about exports lives here, at module
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
import type { members } from './module.f.mjs'

/**
 * A member function of a type: the receiver, typed as the type it is
 * under, and the arguments as the call passed them.
 */
export type TypeMemberFunc<T> = (self: T, ...args: readonly unknown[]) => unknown

/** A type's members: a name, then its function. */
export type TypeMembers<T> = {
    readonly [k in string]: TypeMemberFunc<T>
}

/** An array receiver: any items, never written. */
export type AnyArray = readonly unknown[]

/** The table: a type, then its members. */
export type Members = {
    readonly boolean: TypeMembers<boolean>
    readonly string: TypeMembers<string>
    readonly number: TypeMembers<number>
    readonly bigint: TypeMembers<bigint>
    readonly object: TypeMembers<object>
    readonly array: TypeMembers<AnyArray>
    readonly function: TypeMembers<Function>
}

/** The names a type's prototype has that a module may call. */
type Admitted<P extends readonly string[]> = Extract<P[number], AllowedCall>

/** The seven types, and nothing else. */
type _Types = Assert<Equal<keyof typeof members, keyof Members>>

/** Every type holds exactly the admitted names of its prototype. */
type _Boolean = Assert<Equal<keyof typeof members.boolean, Admitted<typeof booleanPrototype>>>
type _String = Assert<Equal<keyof typeof members.string, Admitted<typeof stringPrototype>>>
type _Number = Assert<Equal<keyof typeof members.number, Admitted<typeof numberPrototype>>>
type _Bigint = Assert<Equal<keyof typeof members.bigint, Admitted<typeof bigintPrototype>>>
type _Object = Assert<Equal<keyof typeof members.object, Admitted<typeof objectPrototype>>>
type _Array = Assert<Equal<keyof typeof members.array, Admitted<typeof arrayPrototype>>>
type _Function = Assert<Equal<keyof typeof members.function, Admitted<typeof functionPrototype>>>
