/**
 * Types for the TypeScript source emitter: the `Equal` compile-time predicate
 * and the `Printer` interface.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'

export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type And<A extends boolean, B extends boolean> =
    [A, B] extends [true, true] ? true : false

type _AndFF = Assert<Equal<And<false, false>, false>>
type _AndFT = Assert<Equal<And<false, true>, false>>
type _AndTF = Assert<Equal<And<true, false>, false>>
type _AndTT = Assert<Equal<And<true, true>, true>>

/**
 * A `struct` field: the key, its type expression, and — when the third
 * element is `true` — an optional-key marker (`"key"?: type`).
 */
export type StructField = readonly [string, string, true?]

/**
 * Functions for emitting TypeScript type expression strings.
 */
export type Printer = {
    readonly tuple: (types: readonly string[]) => string
    readonly struct: (fields: readonly StructField[]) => string
    readonly array: (type: string) => string
    readonly record: (type: string) => string
}

// Index-signature guidance, checked at compile time. Moved here from
// `proof.f.ts` when that file migrated to `.f.mjs`: `declare const` has no
// JavaScript form, and these aliases are type-level only. Non-exported, so
// they add nothing to the emitted declaration.

// Don't use!

type _T0 = {[k:string]: bigint}

declare const x0: _T0

type _X0 = Assert<Equal<typeof x0['hello'], bigint>>

// Use for finite sets

type _T1 = {[k in 'hello']: bigint}

declare const x1: _T1

type _X1 = Assert<Equal<typeof x1['hello'], bigint>>

// Don't use it

type _T2 = {[k in string]: bigint}

declare const x2: _T2

type _X2 = Assert<Equal<typeof x2['hello'], bigint>>

// Use it for infinite sets

type _T3 = {[k in string]?: bigint}

declare const x3: _T3

type _X3 = Assert<Equal<typeof x3['hello'], bigint | undefined>>

// type T4 = {[k:string]?: bigint} //< compilation error.
