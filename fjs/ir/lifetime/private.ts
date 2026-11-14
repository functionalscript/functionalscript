/**
 * What the [lifetime pass](./module.f.js) carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Interface, Sealed, Signature, Term, Typed } from '../types.ts'

/**
 * A local as the pass sees it: one that its region owns, of its sealed
 * type; a borrow, a parameter that borrows or the name of an arm; a product
 * that holds a sealed value, with the locals that it was made from, which
 * it leans on; or one that holds no sealed value.
 */
export type _Local =
    | readonly ['own', type: Sealed]
    | readonly ['borrow']
    | readonly ['view', from: readonly string[]]
    | readonly ['plain']

/** How a term's context takes its value: it takes it over, so that it owns it, or it only borrows it. */
export type _Mode = 'take' | 'read'

/**
 * What a label names: the function's `return`; a block, with how its
 * context takes its value; or a loop, with how a repeat gives each of its
 * parameters.
 */
export type _Target =
    | readonly ['return']
    | readonly ['block', mode: _Mode]
    | readonly ['loop', modes: readonly _Mode[]]

/**
 * A region that a label opens, outermost first: its label, the owned locals
 * of the region around it where it begins, and what the label names.
 */
export type _Frame = readonly [label: string, outer: readonly string[], target: _Target]

/**
 * Where a term stands: the name of its function or its constant, the
 * module's signatures and interfaces, every name that the function or the
 * constant binds, so that no new name takes one, and the locals and the
 * regions in scope.
 */
export type _Env = {
    readonly fn: string
    readonly functions: OrderedMap<Signature>
    readonly imports: OrderedMap<Interface>
    readonly taken: readonly string[]
    readonly locals: OrderedMap<_Local>
    readonly frames: readonly _Frame[]
}

/**
 * A term written in the owned stage: the term, the owned locals of its
 * region alive after it, which mean nothing where its type is `never`,
 * since it never completes, and the number of the next new name.
 */
export type _Step = {
    readonly term: Term
    readonly owned: readonly string[]
    readonly n: number
}

/** Terms written in their order: the terms, the owned locals alive after the last, and the number of the next new name. */
export type _Steps = {
    readonly terms: readonly Term[]
    readonly owned: readonly string[]
    readonly n: number
}

/** Write one term in the owned stage, from the owned locals of its region alive before it and the locals that are read after it. */
export type _Go = (env: _Env, t: Typed, mode: _Mode, owned: readonly string[], live: readonly string[], n: number) => Result<_Step, string>

/** Name the temporaries of one term, from the number of the next new name. */
export type _Name = (env: _Env, t: Typed, n: number) => readonly [Typed, number]
