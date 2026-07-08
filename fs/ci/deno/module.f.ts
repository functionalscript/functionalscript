/**
 * CI step builder for Deno: installs the pinned Deno version and runs the
 * FunctionalScript package smoke test plus Deno coverage in one canonical job.
 *
 * @module
 */
import { deno } from '../config/module.f.ts'
import { type MetaStep, clean, install, test, uses } from '../common/module.f.ts'

const denoTest = 'deno test --allow-read --allow-env --allow-sys' as const

export const denoSteps = (version: string): readonly MetaStep[] => clean([
    install(uses('denoland/setup-deno', { 'deno-version': deno })),
    // we need --minimum-dependency-age=0 for functionalscript because we would like to use
    // the latest version of the package even if it is not yet 24 hours old,
    // which is the default minimum dependency age for Deno installs
    install({ run: `deno install -g -A npm:functionalscript@${version} --minimum-dependency-age=0` }),
    test({ run: `deno run -A npm:functionalscript@${version} t` }),
    test({ run: 'deno install --frozen' }),
    test({ run: `${denoTest} --coverage && deno coverage --include='.*module\\.f\\.ts'` }),
])
