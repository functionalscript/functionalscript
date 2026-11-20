/** Selected normal results recovered after tail control placement. @module */

import type { Block, Value } from '../../../js/ast/types.ts'

export type _Selected = { readonly value: Value; readonly then: Block; readonly otherwise: Block }

/** The one selected arm that holds every read of a recipe, and what holds it rebuilt over another arm. */
export type _Arm<T> = { readonly arm: Block; readonly rebuilt: (arm: Block) => T }
