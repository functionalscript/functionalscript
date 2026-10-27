/**
 * @module
 * @import { MetaStep } from '../common/types.ts'
 */

import { deno } from '../config/module.f.js'
import { environmentSteps, environmentVersionStep } from '../environment/module.f.mjs'

/**
 * Deno prints three lines for `--version` — the runtime, V8 and TypeScript — so
 * comparing the whole output would pin two versions this repository does not
 * configure. `Deno.version.deno` is the one field, on one line.
 *
 */
const denoVersionStep = environmentVersionStep(
    `deno eval 'console.log(Deno.version.deno)'`,
    deno)

/**
 * @type {readonly MetaStep[]}
 */
export const denoSteps = [
    denoVersionStep,
    ...environmentSteps([
        'deno install --frozen',
        'deno task cov',
    ]),
]
