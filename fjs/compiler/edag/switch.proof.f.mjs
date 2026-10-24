/**
 * The proof of the switch statement's lowering, split off `./proof.f.mjs`
 * when that file outgrew what the website's build accepts in one file —
 * 128 KiB, which it passed at `258b0e3b` — along the seam its sections
 * draw, beside the guards' and the loops'. It reads the lowering as that
 * proof does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 *
 * @import { Exp } from '../../edag/types.ts'
 */

import { apply, compile, expectEdag, value } from './proof.f.mjs'
import { assert, assertStructurallySame } from '../../asserts/module.f.js'

export const proof = {
    // A switch, `switch (d) { case a: case b: { … } … }`, is sugar as the
    // guard is: the fold makes of it the conditional of each case's test —
    // the discriminant, an entry of the body, `===` each label, the labels
    // of one case joined by conditional regions — over the call of its block, the `default`
    // block or the statements after the switch the last alternate, so a
    // switch and the chain of guards over a `const` of the discriminant are
    // one graph, and `switch` adds no node.
    switches: {
        graphs: () => {
            expectEdag(compile('export default (n) => { switch (n) { case 1: { return 1; } } return 2; };').edag, ['=>', 1, [], ['?:', ['===', ['arg', 0], 1], 1, 2]])
            /** @type {Exp} */
            const d = ['.', ['arg', 0], 0]
            expectEdag(compile('export default (n) => { switch (n[0]) { case 1: case 2: { return 1; } case 3: { throw 3; } default: { return 0; } } };').edag, ['=>', 1, [], ['?:', ['?:', ['===', d, 1], ['===', d, 1], ['===', d, 2]], 1, ['?:', ['===', d, 3], ['throw', 3], 0]]])
            /** @type {Exp} */
            const one = ['[]', [1]]
            expectEdag(compile('export default (n) => { switch (n[0]) { case 1: { const x = [1]; return [x, x]; } } const y = [2]; return y; };').edag, ['=>', 1, [], ['?:', ['===', d, 1], ['[]', [one, one]], ['[]', [2]]]])
        },
        // the graph is the one the chain of guards has, node for node: the
        // discriminant is one node however many labels test it
        sameAsSpelled: () => {
            /** @type {(switched: string, spelled: string) => void} */
            const same = (switched, spelled) => assertStructurallySame(compile(switched).edag, compile(spelled).edag)
            same('export default (n) => { switch (n[0]) { case 1: case 2: { return 1; } case 3: { throw 3; } default: { return 0; } } };', 'export default (n) => { const d = n[0]; if (d === 1 || d === 2) { return 1; } if (d === 3) { throw 3; } return 0; };')
            same('export default (n) => { switch (n[0]) { case 1: { const x = [1]; return [x, x]; } } const y = [2]; return y; };', 'export default (n) => { const d = n[0]; if (d === 1) { const x = [1]; return [x, x]; } const y = [2]; return y; };')
            same('export default (n) => { switch (n) { case 1: { return 1; } } return 2; };', 'export default (n) => n === 1 ? 1 : 2;')
            const shared = compile('export default (n) => { switch (n[0]) { case 1: case 2: { return 1; } } return 0; };').edag
            const or = /** @type {readonly any[]} */ (/** @type {readonly any[]} */ (shared)[3])[1]
            assert(or[1] === or[2] && or[1][1] === or[3][1], shared)
        },
        // what a switch computes, through the memo executor: strict
        // equality, the first match, and the `default` on none
        run: () => {
            const kind = value(compile('export default (n) => { switch (n) { case 1: case 2: { return "low"; } case 3: { return "three"; } default: { return "other"; } } };').edag)
            assertStructurallySame([apply(kind, [1]), apply(kind, [2]), apply(kind, [3]), apply(kind, [4]), apply(kind, ['1'])], ['low', 'low', 'three', 'other', 'other'])
        },
    },
}
