/** Implementation details of normalized FAST graph construction. @module */

import type { Operator, Value } from '../../js/ast/types.ts'
import type { Lowered } from './types.ts'

export type Work =
    | { readonly kind: 'expand'; readonly value: Value; readonly rest: Work }
    | { readonly kind: 'operator'; readonly operator: Operator<Value>; readonly operands: readonly Value[]; readonly rest: Work }
    | null

export type Results = { readonly value: Lowered; readonly rest: Results } | null
