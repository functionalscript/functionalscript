/**
 * Proofs for the corpus rule: everything is compared unless an exception says
 * why not.
 */

import { assert, assertStructurallySame } from '../../asserts/module.f.mjs'
import { corpus, exceptions } from './module.f.mjs'

export const proof = {
    corpus: {
        keepsModulesAndLeavesExceptionsOut: () => {
            assertStructurallySame(
                corpus(['a.mjs', 'function.mjs', 'b.mjs', 'rest-function.mjs', 'function-text.mjs']),
                ['a.mjs', 'b.mjs'])
        },
        leavesNonModulesOut: () => {
            assertStructurallySame(corpus(['README.md', 'a.mjs', 'helpers']), ['a.mjs'])
        },
        newFixtureIsComparedByDefault: () => {
            assertStructurallySame(corpus(['brand-new.mjs']), ['brand-new.mjs'])
        },
    },
    exceptions: {
        everyOneIsAModuleWithAReason: () => {
            const entries = Object.entries(exceptions)
            assert(entries.length > 0)
            for (const [file, reason] of entries) {
                assert(file.endsWith('.mjs'))
                assert(reason.length > 0)
            }
        },
    },
}
