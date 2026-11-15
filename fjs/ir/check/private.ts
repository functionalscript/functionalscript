/**
 * What the checker carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Interface, Signature, Term, Type, Typed } from '../types.ts'

/** What a label names: a `block`, which a `br` leaves with a value of its type, or a `loop`, which a `br` repeats with its parameters. */
export type _Label = readonly ['block', Type] | readonly ['loop', readonly (readonly [name: string, type: Type])[]]

/**
 * The scope of a term: the name of its function or its constant, the locals
 * and labels it sees, the module's functions, the interfaces it imports,
 * and the types of the module's constants.
 */
export type _Env = {
    readonly name: string
    readonly locals: OrderedMap<Type>
    readonly labels: OrderedMap<_Label>
    readonly functions: OrderedMap<Signature>
    readonly imports: OrderedMap<Interface>
    readonly constants: OrderedMap<Type>
}

/** Check one term in its current scope. */
export type _CheckTerm = (env: _Env, term: Term) => Result<Typed, string>

/** The narrowest type that holds two types, or null where none does. */
export type _Join = (env: _Env, a: Type, b: Type) => Type | null
