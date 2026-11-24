/** Shared filesystem source identities. @module */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Unknown as JsonUnknown } from '../../media/json/types.ts'
import type { ResolvedModule } from '../parser/types.ts'

/** The host supplies stable identity and a path for loading and diagnostics. */
export type _Source = {
    readonly id: string
    readonly path: string
    readonly json: boolean
}

/** A resolved import retains its selection independently of module identity. */
export type _ImportSource = _Source & { readonly name: string | null }

/**
 * One walk's state: its complete modules by identity, the chain of
 * identities it is inside, and the module it completed last, `null` before
 * the first.
 */
export type _Context<T> = {
    readonly complete: OrderedMap<T>
    readonly stack: List<string>
    readonly latest: T | null
}

/**
 * What a walk makes of a module: a complete `T`, and the `S` an import binds
 * from it. The walk itself is the same for every caller.
 *
 * A module is completed after `previous`, the module the walk completed
 * just before it, `null` for the first: a load that carries something from
 * one module to the next, as the interpreter carries the values it has
 * precomputed, reads it there.
 */
export type _Load<T, S, E> = {
    /** A JSON document, imported `with { type: "json" }`, as a complete module. */
    readonly json: (value: JsonUnknown, previous: T | null) => T
    /** What importing `name` binds, the whole module where `name` is `null`, or `undefined` where the module has no such export. */
    readonly select: (module: T, name: string | null) => S | undefined
    /** A parsed module completed over its imports' bindings, in import order. */
    readonly module: (source: _Source, imports: readonly S[], module: ResolvedModule, previous: T | null) => Result<T, E>
}
