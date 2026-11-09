/** State of one dependency traversal. @module */

import type { StringMap } from '../../../types/object/types.ts'

export type _State = {
    readonly seen: readonly string[]
    readonly scopes: readonly string[]
    readonly files: StringMap<string>
}
