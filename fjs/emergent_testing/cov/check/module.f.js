/**
 * Coverage targets and exact native-count admission for isolated modules.
 *
 * @module
 * @import { _CoverageFile } from '../types.ts'
 */

import { basename, normalize } from '../../../path/module.f.js'

/** The measured source set, independently of proof discovery.
 * @type {(path: string) => boolean}
 */
export const isCoverageTarget = path =>
    ['module.f.mjs', 'module.f.js', 'demo.f.mjs'].includes(basename(path))

/** A missing, invalid or rounded-away uncovered count cannot pass.
 * @type {(covered: number, total: number) => boolean}
 */
const _complete = (covered, total) =>
    Number.isInteger(total) && total >= 0 && Number.isInteger(covered) && covered === total

/** Validate the exact target set using raw native counts before filtering.
 * @type {(expected: readonly string[], files: readonly _CoverageFile[]) => readonly string[]}
 */
export const _coverageFailures = (expected, files) => [
    ...expected.flatMap(path => {
        const file = files.find(file => normalize(file.path) === normalize(path))
        if (file === undefined) { return [`Missing coverage: ${path}`] }
        return _complete(file.coveredLineCount, file.totalLineCount)
            && _complete(file.coveredBranchCount, file.totalBranchCount)
            && _complete(file.coveredFunctionCount, file.totalFunctionCount)
            ? [] : [`Incomplete coverage: ${path}`]
    }),
    ...files.filter(file => !expected.some(path => normalize(path) === normalize(file.path)))
        .map(file => `Unexpected coverage: ${file.path}`),
]
