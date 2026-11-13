/**
 * What the emitter carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Expr, ValType } from '../../media/wasm/types.ts'
import type { Interface, Type } from '../types.ts'

/** A function that a module calls, its own or an imported one: its index and its parameters' types. */
export type _Callee = readonly [index: number, params: readonly Type[]]

/**
 * The scope of a term: the index of each local that holds a value, the
 * depth and the type of the structure that each label names, how deep the
 * term stands, the first local that no term before it took, the module's
 * functions, the functions of each interface that it imports, and those
 * interfaces, which give its sealed types their carriers.
 */
export type _Env = {
    readonly locals: OrderedMap<number>
    readonly labels: OrderedMap<readonly [depth: number, type: Type]>
    readonly depth: number
    readonly next: number
    readonly functions: OrderedMap<_Callee>
    readonly imports: OrderedMap<OrderedMap<_Callee>>
    readonly interfaces: OrderedMap<Interface>
}

/** A term's code, and the names and types of the locals that it takes, from `next` on. */
export type _Code = {
    readonly code: Expr
    readonly locals: readonly (readonly [name: string, type: ValType])[]
}
