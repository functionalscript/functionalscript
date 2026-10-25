/** Caller-owned deferred recipes selected for normal helper transport. @module */

import type { BindingId, Block, Definition, Loop, Value } from '../../../../../js/ast/types.ts'

export type MemoCell = {
    readonly binding: BindingId
    readonly initializer: Value
    readonly definition: Definition
}

export type MemoPlan = {
    /** Statement occurrences have distinct identities; value operands are opaque. */
    readonly block: Block
    readonly cells: readonly MemoCell[]
    /** Declaration identity selects roots and aliases before lexical activation. */
    readonly definitions: ReadonlyMap<Definition, number>
    readonly loops: ReadonlySet<Loop>
}
