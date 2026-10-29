/**
 * Implementation-private types for `fjs/compiler/graph/module.f.mjs`.
 *
 * @module
 */

import type { Group } from '../../website/demo/graph/types.ts'
import type { BindingId } from '../../js/ast/types.ts'

/** An edge of the drawing: a port's label, the value it reaches, and `lazy` where the position is one the node may never evaluate. */
export type _Child = readonly [label: string, value: unknown, kind?: 'lazy']

/**
 * A chain being drawn, one node however many steps it has: its spelling
 * and rows so far, a group of rows per link, and whether a `?.` has been
 * passed, which makes the operands after it the ones a nullish value
 * skips.
 */
export type _Chain = {
    readonly label: string
    readonly children: readonly _Child[]
    readonly groups: readonly Group[]
    readonly lazy: boolean
}

/** A binding a module defines, and the edges its node draws: what defines it. */
export type _Definition = readonly [id: BindingId, children: readonly _Child[]]


/** Deferred depth-first work in the binding-definition scan. */
export type _DefinitionTask = { readonly definition: _Definition } | { readonly expand: () => readonly _DefinitionTask[] }
