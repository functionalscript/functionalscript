/**
 * What the checker carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Interface, Param, Signature, Type } from '../types.ts'

/** What a label names: a `block`, which a `br` leaves with a value of its type, or a `loop`, which a `br` repeats with its parameters. */
export type _Label = readonly ['block', Type] | readonly ['loop', readonly Param[]]

/** The scope of a term: its function's name, the locals and labels it sees, the module's functions, and the interfaces it imports. */
export type _Env = {
    readonly name: string
    readonly locals: OrderedMap<Type>
    readonly labels: OrderedMap<_Label>
    readonly functions: OrderedMap<Signature>
    readonly imports: OrderedMap<Interface>
}
