/**
 * The host proof of the seeded random comparison: a few hundred programs
 * from a fixed seed, each lowered and run against JavaScript. A wrong
 * answer fails the proof; a refusal the slices state is counted and not
 * run. Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { anyForm, anyForms, closureProgram, compare, compareOne, rng, typedProgram, untypedProgram } from './module.mjs'

/** Typed programs and programs over `any` in one proof run. */
const typedCount = 120
const anyCount = 80
const untypedCount = 60
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
        const out = compare(seed, typedCount, anyCount, untypedCount)
        assert(out.wrong === null, out.wrong)
        assert(out.ran > 0, out)
        assert(out.calls > 0, out)
        assertEq(out.programs, typedCount + anyCount + untypedCount)
        assertEq(out.seed, seed)
    },

    /**
     * A seed that produces a signed body whose inferred range prints as
     * `i(n)`, not `int(...)`: that refusal is expected, not a wrong answer.
     */
    namedRangeRefusal: () => {
        const out = compare(70, 20, 10)
        assert(out.wrong === null, out.wrong)
        assert(out.refused > 0, out)
    },

    /**
     * Float edges list both zeros; a sample keeps `-0` (a `Set` would have
     * dropped it beside `0`), so parameterized `-0` reaches the comparison.
     */
    negativeZeroInput: () => {
        let found = false
        for (let s = 0; s < 50 && !found; s += 1) {
            const rows = typedProgram(rng(s)).inputs.f
            found = rows !== undefined && rows.some(row => row.some(v => typeof v === 'number' && Object.is(v, -0)))
        }
        assert(found)
    },

    /**
     * The forms since slice 8c (object literals and `buildObject`), 9a
     * (numbers and booleans as items) and 9b (calls of function values),
     * thirty programs each from their own seed: each runs, none is refused,
     * and every call agrees.
     */
    laterForms: () => {
        assertEq(anyForms, 18)
        for (const form of [15, 16, 17]) {
            const rnd = rng(seed + form)
            for (let k = 0; k < 30; k += 1) {
                const out = compareOne(anyForm(rnd, form))
                assertEq(out[0], 'ran', `form ${form}: ${String(out[1])}`)
            }
        }
    },

    /**
     * Slice 11a's untyped programs, which no table types, with L1 linked
     * in: a hundred from their own seed, each runs, none is refused, and
     * every call agrees with JavaScript, a throw of JavaScript's error with
     * L1's value of it.
     */
    untyped: () => {
        const rnd = rng(seed + 11)
        for (let k = 0; k < 100; k += 1) {
            const program = untypedProgram(rnd)
            const out = compareOne(program)
            assertEq(out[0], 'ran', `${program.text}: ${String(out[1])}`)
        }
    },

    /**
     * Since 11b, closures of `x` over `a` and `b`: returned, which the judge
     * calls on probes, or passed to a function that a value call calls.
     * Each agrees with JavaScript.
     */
    closures: () => {
        const rnd = rng(seed + 12)
        for (let k = 0; k < 100; k += 1) {
            const program = closureProgram(rnd)
            const out = compareOne(program)
            assertEq(out[0], 'ran', `${program.text}: ${String(out[1])}`)
        }
    },
}
