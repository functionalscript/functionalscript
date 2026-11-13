/**
 * Data passed between isolated coverage planning and the native reporter.
 *
 * @module
 */

import type { Coverage, Event as NativeEvent } from '../node/types.ts'

/** One directory's source files, named relative to that directory. */
export type _Module = {
    readonly directory: string
    readonly files: readonly string[]
}

/** The native coverage fields used to enforce complete coverage. */
export type _CoverageFile = {
    readonly path: string
    readonly totalLineCount: number
    readonly coveredLineCount: number
    readonly totalBranchCount: number
    readonly coveredBranchCount: number
    readonly totalFunctionCount: number
    readonly coveredFunctionCount: number
}

/** Native reporter events, retaining raw coverage counts before filtering. */
export type _Event = Exclude<NativeEvent, Coverage> | (Coverage & {
    readonly data: {
        readonly summary: {
            readonly files: readonly _CoverageFile[]
        }
    }
})
