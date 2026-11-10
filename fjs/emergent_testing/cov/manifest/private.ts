/** Records retained by a shared coverage dependency snapshot. @module */

import type { _Node } from './types.ts'

export type _Closure = {
    readonly seen: readonly string[]
    readonly nodes: readonly _Node[]
    readonly required: readonly string[]
    readonly scopes: readonly string[]
}
