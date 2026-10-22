/**
 * CI step builder for SpiderMonkey: runs `fjs compile` and `fjs t` in the
 * SpiderMonkey shell the shared flake provides, through its partial Node host,
 * as `npm run sm c` and `npm run sm t` — the commands a developer runs. Each
 * reaches host operations the other does not: the compile check reads and
 * resolves every `.f.js`, and the suite imports every authored proof.
 *
 * The steps are not a job of their own. They are part of the `ubuntu-arm`
 * platform job, as the WASM checks are, because the number of jobs rather than
 * their time is what CI waits on — `../todo/six-ci-jobs.md` folds the other
 * runtimes into that job too.
 *
 * @module
 *
 * @import { Architecture, MetaStep, Os } from '../common/types.ts'
 */

import { spidermonkey } from '../config/module.f.js'
import { nixVersionStep } from '../nix/module.f.mjs'
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
        ? [nixVersionStep('js --version', `JavaScript-C${spidermonkey.version}`)]
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
