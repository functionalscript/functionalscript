/** Implementation state for JavaScript function-text generation. @module */

import type { Analysis } from '../../../edag/analysis/types.ts'

/** One admitted function body and the local names of its shared entries. */
export type _Scope = {
    readonly a: Analysis
    readonly path: string
    readonly frame: readonly string[]
    readonly shared: readonly number[]
}
