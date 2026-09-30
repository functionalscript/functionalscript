/**
 * The host context the operator corpus's function-text cases run under:
 * `amnesia` with a `withText` that gives each function the writer's text
 * (`tryFunctionText`), through the host's
 * [`withText`](../../types/function/text/module.mjs) adapter. That is the
 * text `nanvm-lib` answers too.
 *
 * FunctionalScript cannot build this context, since the adapter is a
 * `Proxy`, so [`../proof.f.mjs`](../proof.f.mjs) runs every other case and
 * exports `cases`, and [`proof.mjs`](./proof.mjs) runs the `host` cases
 * under this.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Context } from '../../edag/amnesia/types.ts'
 */

import { tryFunctionText } from '../../compiler/serializer/module.f.mjs'
import { withText } from '../../types/function/text/module.mjs'

/**
 * A `=>` node's text, or none where the writer refuses the body, which
 * `withText` answers with `nanvm-lib`'s refusal (`FUNCTION_TEXT`).
 *
 * @type {(e: Exp) => () => string | undefined}
 */
const text = e => () => {
    const r = tryFunctionText(e)
    return r[0] === 'error' ? undefined : r[1]
}

/** @type {Context} */
export const context = { frame: undefined, args: [], withText: (f, node) => withText(f, text(node)) }
