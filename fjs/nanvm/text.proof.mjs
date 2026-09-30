/**
 * The operator corpus's function-text cases, run by the host.
 *
 * A case marked `host` in [`module.f.mjs`](./module.f.mjs) expects a
 * function's text, which the evaluator answers only through a `withText`
 * that FunctionalScript cannot write. So [`proof.f.mjs`](./proof.f.mjs)
 * runs every other case and exports {@link cases}, and this runs those
 * under the host's: [`withText`](../types/function/text/module.mjs) over
 * the writer's `tryFunctionText`, the text `nanvm-lib` answers too.
 *
 * @import { Exp } from '../edag/types.ts'
 * @import { Context } from '../edag/amnesia/types.ts'
 */

import { assertEq } from '../asserts/module.f.mjs'
import { tryFunctionText } from '../compiler/serializer/module.f.mjs'
import { vm } from '../edag/amnesia/module.f.mjs'
import { withText } from '../types/function/text/module.mjs'
import { cases } from './proof.f.mjs'

/**
 * A `=>` node's text, or `nanvm-lib`'s refusal (`FUNCTION_TEXT`) where the
 * writer refuses the body.
 *
 * @type {(e: Exp) => () => string}
 */
const text = e => () => {
    const r = tryFunctionText(e)
    if (r[0] === 'error') { throw new TypeError('Cannot convert a function to its text') }
    return r[1]
}

/** @type {Context} */
const context = { frame: undefined, args: [], withText: (f, node) => withText(f, text(node)) }

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
    },
}
