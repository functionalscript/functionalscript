/**
 * The host proof of the seeded random comparison: a few hundred programs
 * from a fixed seed, each lowered and run against JavaScript. A wrong
 * answer fails the proof; a refusal the slices state is counted and not
 * run. Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-use-host-proofs-only-for-documented-host-contracts)).
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { compare, rng } from './module.mjs'

/** Typed programs and programs over `any` in one proof run. */
const typedCount = 120
const anyCount = 80
const seed = 0x4f1c_5e2d

export const proof = {
    /** The generator is deterministic: the same seed yields the same first floats. */
    seed: () => {
        const a = rng(seed)
        const b = rng(seed)
        assertEq(a(), b())
        assertEq(a(), b())
    },

    /**
     * Hundreds of random programs: every one that the slices admit agrees
     * with JavaScript on its inputs, and none disagrees. Refusals are
     * expected for programs that need a later slice.
     */
    compare: () => {
        const out = compare(seed, typedCount, anyCount)
        assert(out.wrong === null, out.wrong)
        assert(out.ran > 0, out)
        assert(out.calls > 0, out)
        assertEq(out.programs, typedCount + anyCount)
        assertEq(out.seed, seed)
    },
}
