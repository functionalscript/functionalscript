/**
 * CI step builder for Deno: installs the pinned Deno version and runs the
 * FunctionalScript package smoke test plus Deno coverage in one canonical job.
 *
 * @module
 */
import { deno } from '../config/module.f.ts'
import { type MetaStep, install, test, uses } from '../common/module.f.ts'

const denoTest = 'deno test --allow-read --allow-env --allow-sys' as const

/**
 * The regular expression selecting FunctionalScript implementation modules for
 * Deno coverage. Both authored extensions are included so a module migrated
 * from `.f.ts` to `.f.mjs` stays in the report. Keep it semantically equal to
 * the `--test-coverage-include` list in `package.json` and to the `cov` task in
 * `deno.json`.
 */
export const coverageInclude = '.*module\\.f\\.(ts|mjs)' as const

export const denoSteps = (version: string): readonly MetaStep[] => [
    install(uses('denoland/setup-deno', { 'deno-version': deno })),
    // We need --minimum-dependency-age=0 for functionalscript because we would like to use
    // the latest version of the package even if it is not yet 24 hours old,
    // which is the default minimum dependency age for Deno installs.
    // This way we can test the latest version of the package in CI without waiting for 24 hours.
    install({ run: `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${version}` }),
    test({ run: `deno run -A --minimum-dependency-age=0 npm:functionalscript@${version} test` }),
    test({ run: 'deno install --frozen' }),
    test({ run: `${denoTest} --coverage && deno coverage --include='${coverageInclude}'` }),
]
