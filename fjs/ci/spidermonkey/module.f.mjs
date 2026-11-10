/** SpiderMonkey checks in the selected environment. @module
 * @import { MetaStep } from '../common/types.ts'
 */

import { spidermonkey } from '../config/module.f.js'
import { environmentSteps, environmentVersionStep } from '../environment/module.f.mjs'

/** Version check, compilation, then the FJS suite on a dedicated ARM Linux job.
 * @type {readonly MetaStep[]}
 */
export const spiderMonkeySteps = [
    environmentVersionStep('js --version', `JavaScript-C${spidermonkey.version}`),
    ...environmentSteps(['npm run sm c', 'npm run sm t']),
]
