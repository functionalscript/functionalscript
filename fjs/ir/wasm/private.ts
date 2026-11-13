/**
 * What the emitter carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Expr, ValType } from '../../media/wasm/types.ts'
import type { Type, Typed } from '../types.ts'

/** A function of the module: its index and its parameters' types. */
export type _Callee = readonly [index: number, params: readonly Type[]]

/**
 * The scope of a term: the index of each local that holds a value, the
 * depth and the type of the structure that each label names, how deep the
 * term stands, the first local that no term before it took, and the
 * module's functions.
 */
export type _Env = {
    readonly locals: OrderedMap<number>
    readonly labels: OrderedMap<readonly [depth: number, type: Type]>
    readonly depth: number
    readonly next: number
    readonly functions: OrderedMap<_Callee>
}

/** A term's code, and the names and types of the locals that it takes, from `next` on. */
export type _Code = {
    readonly code: Expr
    readonly locals: readonly (readonly [name: string, type: ValType])[]
}

/** Emit one typed term in its current scope. */
export type _EmitTerm = (env: _Env, term: Typed) => _Code

/**
 * A value of the IR on the host, as the host proof passes it: an integer as
 * a `bigint`, a float as a `number`, and a `bool` as a `boolean`.
 */
export type _Value = bigint | number | boolean

/** A function's JavaScript twin, on its arguments in their order. */
export type _Twin = (xs: readonly _Value[]) => _Value
