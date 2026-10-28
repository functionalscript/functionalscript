/** Selected normal results recovered after tail control placement. @module */

import type { Block, Value } from '../../../js/ast/types.ts'

export type _Selected = { readonly value: Value; readonly then: Block; readonly otherwise: Block }
