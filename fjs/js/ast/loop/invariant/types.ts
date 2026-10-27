/** Established aliases at a canonical loop's graph-construction boundary. */

import type { BindingId, Loop, Value } from '../../types.ts'

export type InvariantAlias = {
    readonly parameter: BindingId
    readonly result: BindingId
    readonly value: Value
}

/** Source state stays explicit; graph construction may reuse scalar state. */
export type InvariantState = {
    readonly loop: Loop
    readonly aliases: readonly InvariantAlias[]
}
