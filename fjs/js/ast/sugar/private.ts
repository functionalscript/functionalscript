/** Implementation details of the admitted-source to FAST conversion. @module */

import type { AstConst } from '../../../compiler/ast/types.ts'
import type { Operator, Value } from '../types.ts'

export type Scope = {
    readonly imports: readonly Value[]
    readonly consts: readonly Value[]
    readonly parameters: readonly Value[]
    readonly rest: Value
    readonly self: Value
    readonly frame: readonly Value[]
}

export type Work =
    | { readonly kind: 'expand'; readonly value: AstConst; readonly rest: Work }
    | { readonly kind: 'operator'; readonly value: Operator<AstConst>; readonly operands: readonly AstConst[]; readonly rest: Work }
    | null

export type Results = { readonly value: Value; readonly rest: Results } | null
