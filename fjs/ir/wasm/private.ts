/**
 * What the emitter carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Expr, FuncType, ValType } from '../../media/wasm/types.ts'
import type { Interface, Type } from '../types.ts'

/** A function that a module calls, its own or an imported one: its index and its parameters' types. */
export type _Callee = readonly [index: number, params: readonly Type[]]

/**
 * What a label names: a `block` of a type, or a `loop`, with the first local
 * and the type of each of its parameters, which a `br` to it sets.
 */
export type _Target = readonly ['block', Type] | readonly ['loop', readonly (readonly [local: number, type: Type])[]]

/**
 * The scope of a term: the first index of each local that holds a value,
 * the depth of the structure that each label names and what it is, how deep
 * the term stands, the first local that no term before it took, the
 * module's functions, the functions of each interface that it imports,
 * those interfaces, which give its sealed types their carriers, and the
 * module's type section, which gives a block of more than one value its
 * type.
 */
export type _Env = {
    readonly locals: OrderedMap<number>
    readonly labels: OrderedMap<readonly [depth: number, target: _Target]>
    readonly depth: number
    readonly next: number
    readonly functions: OrderedMap<_Callee>
    readonly imports: OrderedMap<OrderedMap<_Callee>>
    readonly interfaces: OrderedMap<Interface>
    readonly types: readonly FuncType[]
}

/** A term's code, and the names and types of the locals that it takes, from `next` on. */
export type _Code = {
    readonly code: Expr
    readonly locals: readonly (readonly [name: string, type: ValType])[]
}
