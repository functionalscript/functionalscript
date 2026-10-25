/**
 * @module
 * @import { Architecture, MetaStep, Os } from '../common/types.ts'
 */

import { spidermonkey } from '../config/module.f.js'
import { environmentVersionStep } from '../environment/module.f.mjs'
import { isUbuntuArm } from '../common/module.f.mjs'

/**
 * The platform whose job runs SpiderMonkey: ARM Linux.
 *
 * @type {(v: Os, a: Architecture) => boolean}
 */
const spiderMonkeyPlatform = isUbuntuArm

/**
 * What a platform job asserts before running anything: on
 * {@link spiderMonkeyPlatform}, the shell's whole version, which the attribute
 * does not name. `js --version` prints it after `JavaScript-C`.
 *
 * @type {(v: Os, a: Architecture) => readonly MetaStep[]}
 */
export const shellSpiderMonkeyVersionSteps = (v, a) =>
    spiderMonkeyPlatform(v, a)
        ? [environmentVersionStep('js --version', `JavaScript-C${spidermonkey.version}`)]
        : []

/**
 * What a platform job runs in the shell for SpiderMonkey: on
 * {@link spiderMonkeyPlatform}, the compile check, then the suite — the order
 * the Node jobs run them in, the seconds-long check failing first.
 *
 * @type {(v: Os, a: Architecture) => readonly string[]}
 */
export const shellSpiderMonkeyCommands = (v, a) =>
    spiderMonkeyPlatform(v, a) ? ['npm run sm c', 'npm run sm t'] : []
