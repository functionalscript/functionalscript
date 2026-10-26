/** Member resolution retained between the property read and call guard. @module */

import type { EdagValue } from '../value/types.ts'

export type _ResolvedMember = {
    readonly name: string
    readonly value: EdagValue
    readonly builtin: boolean
}
