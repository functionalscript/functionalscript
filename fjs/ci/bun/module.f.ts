/**
 * CI step builder for Bun: installs the pinned Bun version and runs the
 * FunctionalScript package smoke test plus Bun coverage in one canonical job.
 *
 * @module
 */
import { bun } from '../config/module.f.ts'
import { type MetaStep, install, test, uses } from '../common/module.f.ts'

export const bunSteps = (version: string): readonly MetaStep[] => [
    install(uses('oven-sh/setup-bun', { 'bun-version': bun })),
    install({ run: `bun install -g functionalscript@${version}` }),
    test({ run: 'bun install --frozen-lockfile' }),
    test({ run: `bunx functionalscript@${version} t` }),
    test({ run: 'bun test --coverage' }),
]
