/**
 * CI step builder for Deno: installs the pinned Deno version and runs the
 * FunctionalScript package smoke test plus Deno coverage in one canonical job.
 *
 * @module
 */
import { deno } from '../config/module.f.ts'
import { type MetaStep, clean, install, test, uses } from '../common/module.f.ts'

export const denoSteps = (version: string): readonly MetaStep[] => clean([
    install(uses('denoland/setup-deno', { 'deno-version': deno })),
    install({ run: `deno install -g -A npm:functionalscript@${version}` }),
    test({ run: 'deno install --frozen' }),
    test({ run: `deno run -A npm:functionalscript@${version} t` }),
    test({ run: "deno test -A && deno coverage --include='.*module\\.f\\.ts'" }),
])
