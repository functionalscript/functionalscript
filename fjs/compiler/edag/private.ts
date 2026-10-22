/**
 * Implementation-private types for `fjs/compiler/edag/module.f.mjs` and
 * its `demo.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'

/**
 * A module's full result and its export bindings. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly bindings: readonly (readonly [string, Exp])[]
}

/** An edge of `demo.f.mjs`'s drawing: a port's label, the value it reaches, and `lazy` where the position is one the node may never evaluate. */
export type _Child = readonly [label: string, value: Exp, kind?: 'lazy']

/**
 * A chain `demo.f.mjs` is drawing, one node however many steps it has: the
 * label and ports so far, the spelling of the key the next call is on — none
 * after a call, whose value has no name — and whether a `?.` has been
 * passed, which makes the operands after it the ones a nullish value skips.
 */
export type _Chain = {
    readonly label: string
    readonly children: readonly _Child[]
    readonly key: string
    readonly lazy: boolean
}
