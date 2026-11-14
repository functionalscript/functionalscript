/**
 * @import { _CoverageFile } from '../types.ts'
 */

import { assert, assertStructurallySame } from '../../../asserts/module.f.js'
import { _coverageFailures, isCoverageTarget } from './module.f.js'

/** @type {(path: string) => _CoverageFile} */
const _full = path => ({
    path, totalLineCount: 2, coveredLineCount: 2,
    totalBranchCount: 1, coveredBranchCount: 1,
    totalFunctionCount: 1, coveredFunctionCount: 1,
})

export const proof = /** @type {const} */ ({
    targets: () => {
        for (const path of /** @type {const} */ (['module.f.mjs', './a/module.f.js', '/b/demo.f.mjs', 'C:\\a\\module.f.js'])) {
            assert(isCoverageTarget(path))
        }
        for (const path of /** @type {const} */ (['proof.f.mjs', 'module.mjs', 'example.f.mjs', 'demo.f.js', 'module.f.mjs.map'])) {
            assert(!isCoverageTarget(path))
        }
    },
    completeCounts: () => {
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [_full('/a/module.f.mjs')]), [])
        assertStructurallySame(_coverageFailures(['C:/a/module.f.mjs'], [_full('C:\\a\\module.f.mjs')]), [])
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [{
            ..._full('/a/module.f.mjs'), totalBranchCount: 0, coveredBranchCount: 0,
            totalFunctionCount: 0, coveredFunctionCount: 0,
        }]), [])
        assertStructurallySame(_coverageFailures([], []), [])
    },
    exactTargets: () => {
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], []), ['Missing coverage: /a/module.f.mjs'])
        assertStructurallySame(_coverageFailures([], [_full('/extra/module.f.mjs')]), ['Unexpected coverage: /extra/module.f.mjs'])
        assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [_full('/extra/module.f.mjs')]), [
            'Missing coverage: /a/module.f.mjs', 'Unexpected coverage: /extra/module.f.mjs',
        ])
    },
    incompleteAndInvalidCounts: () => {
        for (const file of /** @type {const} */ ([
            { ..._full('/a/module.f.mjs'), coveredLineCount: 1 },
            { ..._full('/a/module.f.mjs'), coveredBranchCount: 0 },
            { ..._full('/a/module.f.mjs'), coveredFunctionCount: 0 },
            { ..._full('/a/module.f.mjs'), totalLineCount: NaN },
            { ..._full('/a/module.f.mjs'), totalLineCount: -1 },
            { ..._full('/a/module.f.mjs'), coveredLineCount: 0.5 },
        ])) {
            assertStructurallySame(_coverageFailures(['/a/module.f.mjs'], [file]), ['Incomplete coverage: /a/module.f.mjs'])
        }
    },
})
