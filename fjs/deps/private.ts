/** State collected by the syntax dependency command. @module */

import type { StringMap } from '../types/object/types.ts'

export type _Checked = {
    readonly checked: number
    readonly refused: number
    readonly seen: readonly string[]
    readonly graph: StringMap<readonly string[]>
}
