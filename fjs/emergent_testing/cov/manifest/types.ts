/** Dependency manifests for one directory's isolated coverage. @module */

import type { Unknown } from '../../../media/json/types.ts'
import type { StringMap } from '../../../types/object/types.ts'

export type Manifest = {
    readonly version: 1
    readonly directory: string
    readonly targets: readonly string[]
    readonly files: StringMap<string>
    readonly contract: Unknown
}
