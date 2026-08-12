/**
 * CI step builder for Bun: installs the pinned Bun version and runs the
 * FunctionalScript package smoke test plus Bun coverage in one canonical job.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { bun } from '../config/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'

/** @type {(version: string) => readonly MetaStep[]} */
export const bunSteps = version => [
    install(uses('oven-sh/setup-bun', { 'bun-version': bun })),
    install({ run: `bun install -g functionalscript@${version}` }),
    test({ run: 'bun install --frozen-lockfile' }),
    test({ run: `bunx functionalscript@${version} test` }),
    test({ run: 'bun test --coverage' }),
]
