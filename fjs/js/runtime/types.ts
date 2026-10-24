/**
 * Type-level API for `fjs/js/runtime/module.f.js`: the pins that keep the
 * tables inside the admitted set and the `runtime` export the two
 * functions over them — every key `member` holds is a name `allowedCalls`
 * admits, and every entry a member body; the keys of `statics` are
 * exactly the ids `fjs/js/static` admits, and every entry a body — or, at
 * a path every executor binds natively, the built-in itself. A
 * compile-time claim about exports lives here, at module scope, where
 * `tsc` checks it whatever a proof body does.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { StaticId } from '../../edag/types.ts'
import type { AllowedCall } from '../prototype/types.ts'
import type { member, runtime, statics } from './module.f.js'

/** The runtime: `static`, a static function by its id, and `dot`, the callee of a member call. */
export type Runtime = typeof runtime

type _Sections = Assert<Equal<keyof Runtime, 'dot' | 'static'>>

/** The static read: the function at an id, or `undefined`. */
export type Static = Runtime['static']

type _Static = Assert<Equal<Static, (id: string) => unknown>>

/** The dispatcher: the callee of `self[key](...)`, or `undefined`. */
export type Dot = Runtime['dot']

type _Dot = Assert<Equal<Dot, (self: unknown, key: string) => unknown>>

/** The member table: a member name, then its body. */
export type Member = typeof member

/** A member name the table holds. */
export type MemberName = keyof Member

/**
 * A member body: a function of the receiver alone, answering `undefined`
 * for a receiver the name is no member of, or the function of the
 * arguments as the call passed them. An executor asks the first step
 * before any argument exists, which is what the guard of an optional call
 * needs, and the second with the arguments, whose failure is a throw.
 */
export type Body = (self: unknown) => undefined | ((...args: never[]) => unknown)

/** Every key is an allowed name. */
type _Keys = Assert<Equal<MemberName extends AllowedCall ? true : false, true>>

/** Every entry is a member body. */
type _Entries = Assert<Equal<Member[MemberName] extends Body ? true : false, true>>

/** The static table: a static function's id, then its body or the built-in itself. */
export type Statics = typeof statics

/** The keys are the admitted ids, one for one: an id with no entry, or an entry no id admits, fails here. */
type _StaticKeys = Assert<Equal<keyof Statics, StaticId>>

/** A static body: a function of the arguments alone. */
export type StaticBody = (...args: never[]) => unknown

/** Every entry is a function. */
type _StaticEntries = Assert<Equal<Statics[StaticId] extends StaticBody ? true : false, true>>

/** A native is the built-in itself, never a body beside it, which would be a second implementation. */
type _NativeIsTheBuiltIn = Assert<Equal<Statics['Object.entries'], typeof Object.entries>>
