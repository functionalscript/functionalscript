/** Bun checks in the selected environment. @module
 * @import { MetaStep } from '../common/types.ts'
 */
import { bun } from '../config/module.f.js'
import { environmentSteps, environmentVersionStep } from '../environment/module.f.mjs'
/** @type {readonly MetaStep[]} */
export const bunSteps = [
    environmentVersionStep('bun --version', bun),
    ...environmentSteps(['bun install --frozen-lockfile', 'bun test --coverage']),
]
