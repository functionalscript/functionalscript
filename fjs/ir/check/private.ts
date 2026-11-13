/**
 * What the checker carries through a function.
 *
 * @module
 */

import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Signature, Type } from '../types.ts'

/** The scope of a term: its function's name, the locals and labels it sees, and the module's functions. */
export type _Env = {
    readonly name: string
    readonly locals: OrderedMap<Type>
    readonly labels: OrderedMap<Type>
    readonly functions: OrderedMap<Signature>
}
