/**
 * CI step builder for Deno: installs the pinned Deno version and runs the
 * FunctionalScript package smoke test plus Deno coverage in one canonical job.
 *
 * Coverage runs through `deno task cov`, so `deno.json` owns the permission set
 * and the coverage filter, exactly as `npm run cov` leaves them to
 * `package.json` for the Node jobs. The two `cov` definitions select the same
 * modules and should stay semantically equal.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { deno } from '../config/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'

/** @type {(version: string) => readonly MetaStep[]} */
export const denoSteps = version => [
    install(uses('denoland/setup-deno', { 'deno-version': deno })),
    // We need --minimum-dependency-age=0 for functionalscript because we would like to use
    // the latest version of the package even if it is not yet 24 hours old,
    // which is the default minimum dependency age for Deno installs.
    // This way we can test the latest version of the package in CI without waiting for 24 hours.
    install({ run: `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${version}` }),
    test({ run: `deno run -A --minimum-dependency-age=0 npm:functionalscript@${version} test` }),
    test({ run: 'deno install --frozen' }),
    test({ run: 'deno task cov' }),
]
