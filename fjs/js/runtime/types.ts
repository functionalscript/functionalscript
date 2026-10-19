/**
 * Type-level API for `fjs/js/runtime/module.f.js`: the pins that keep the
 * table inside the admitted set — `member` and `static` are its two
 * sections and `dot` the dispatcher over them; every key `member` holds
 * is a name `allowedCalls` admits, and
 * every entry a member body; every path `static` holds is one
 * `fjs/js/static` admits, and every entry a body — or, at a path every
 * executor binds natively, the built-in itself. A compile-time claim
 * about exports lives here, at module scope, where `tsc` checks it
 * whatever a proof body does.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { AllowedCall } from '../prototype/types.ts'
import type { StaticPath } from '../static/types.ts'
import type { runtime } from './module.f.js'

/** The table: `member`, then a member name, then its body; `static`, then a path's keys, then its body. */
export type Runtime = typeof runtime

/** The member section: a member name, then its body. */
export type Member = Runtime['member']

/** A member name the section holds. */
export type MemberName = keyof Member

/**
 * A member body: a function of the receiver alone, answering `undefined`
 * for a receiver the name is no member of, or the function of the
 * arguments as the call passed them. An executor asks the first step
 * before any argument exists, which is what the guard of an optional call
 * needs, and the second with the arguments, whose failure is a throw.
 */
export type Body = (self: unknown) => undefined | ((...args: never[]) => unknown)

type _Sections = Assert<Equal<keyof Runtime, 'dot' | 'member' | 'static'>>

/** The dispatcher: the callee of `self[key](...)`, or `undefined`. */
export type Dot = Runtime['dot']

type _Dot = Assert<Equal<Dot, (self: unknown, key: string) => unknown>>

/** Every key is an allowed name. */
type _Keys = Assert<Equal<MemberName extends AllowedCall ? true : false, true>>

/** Every entry is a member body. */
type _Entries = Assert<Equal<Member[MemberName] extends Body ? true : false, true>>

/** The static section: a global's name, then a namespace's member or the function the global is. */
export type Static = Runtime['static']

/**
 * Every path the static section holds a body at: `[G, n]` for a
 * namespace's member, `[G]` for a global that is a function.
 */
export type StaticBodyPath = {
    readonly [G in keyof Static]: Static[G] extends Body
        ? readonly [G]
        : { readonly [N in keyof Static[G]]: readonly [G, N] }[keyof Static[G]]
}[keyof Static]

/** A static body: a function of the arguments alone. */
export type StaticBody = (...args: never[]) => unknown

/** Every path with an entry is admitted. */
type _StaticAdmitted = Assert<Equal<StaticBodyPath extends StaticPath ? true : false, true>>

/** Every admitted path holds a value: the natives too, each the built-in itself, never a body beside it, which would be a second implementation. */
type _Complete = Assert<Equal<StaticPath extends StaticBodyPath ? true : false, true>>
type _NativeIsTheBuiltIn = Assert<Equal<Static['Object']['entries'], typeof Object.entries>>

/** Every entry of the static section. */
type StaticEntry = {
    readonly [G in keyof Static]: Static[G] extends StaticBody ? Static[G] : Static[G][keyof Static[G]]
}[keyof Static]

type _StaticEntries = Assert<Equal<StaticEntry extends StaticBody ? true : false, true>>
