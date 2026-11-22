/** Selected normal results recovered after tail control placement. @module */

import type { Block, LoopTarget, Value } from '../../../js/ast/types.ts'

export type _Selected = { readonly value: Value; readonly then: Block; readonly otherwise: Block }

/** The one selected arm that holds every read of a recipe, and what holds it rebuilt over another arm. */
export type _Arm<T> = { readonly arm: Block; readonly rebuilt: (arm: Block) => T }

/**
 * A way a region ends without having read a recipe: by completing, by a
 * `break` to the loop, or `away` by a `return` or a `continue`.
 */
export type _Way = 'normal' | 'away' | LoopTarget

/** What `unread` is asked about: a value, values or a block's statements from an index on. */
export type _Region =
    | readonly ['value', Value]
    | readonly ['values', readonly Value[], number]
    | readonly ['skipped', readonly Value[], number]
    | readonly ['block', Block, number]
