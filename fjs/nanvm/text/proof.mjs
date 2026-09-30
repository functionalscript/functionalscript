/**
 * Proofs for the host context in [`module.mjs`](./module.mjs): the
 * operator corpus's `host` cases, and a captured and a refused text.
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { vm } from '../../edag/amnesia/module.f.mjs'
import { cases } from '../proof.f.mjs'
import { context } from './module.mjs'

export const proof = {
    cases: cases(context, c => c.host !== undefined),
    /** A function's text is its code's: a captured value is its slot's name. */
    captured: () => {
        const f = vm(context)(['()', ['=>', 0, [], ['=>', 0, [['.', ['rest'], 0]], ['[]', [['frame', 0]]]]], ['[]', [5]]])
        assertEq(String(f), '()=>[$0]')
        assertEq(/** @type {() => readonly unknown[]} */ (f)()[0], 5)
    },
    throw: {
        /** The writer has no spelling for a `!` node, so the text is refused. */
        refused: () => String(vm(context)(['=>', 0, [], ['!', 1]])),
        /** And so is `f < 5`, which the host cannot tell from `f < "z"`. */
        refusedComparison: () => vm(context)(['<', ['=>', 0, [], ['!', 1]], 5]),
    },
}
