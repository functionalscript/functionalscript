/**
 * What a method is without its receiver, run on the host engine: the three
 * cases of `./proof.f.js`'s `chainsJs` that read a method as a value (`a.at`
 * without a call). FunctionalScript does not read one, so they are kept
 * apart from that proof, which holds every other chain case.
 */

import { assertEq } from '../asserts/module.f.js'

/**
 * The naive desugaring of `a?.at` — the shape `?.` looks like it could lower
 * to. It guards both nullish values, as `?.` does: `null?.at` is `undefined`,
 * not a throw, so a guard on `undefined` alone would not be the desugaring of
 * anything. Every branch is taken by `chainsJs.desugaredOptional`, which is
 * also where the assertions live: an assertion inside a `throw` case would be
 * masked, since a failing one throws and so reads as the expected failure.
 *
 * @type {(o: any) => any}
 */
const desugarOptionalAt = o => o !== null && o !== undefined ? o.at : undefined

export const proof = {
    chainsJs: {
        // What the naive desugaring of `?.` gets right, every branch of it:
        // `undefined` on either nullish input, and on anything else the *same
        // function* `a.at` denotes. Nothing is wrong with any of those values
        // — what it loses is the receiver, which `throw.desugaredOptional`
        // pins by calling the last one. That is why `?.` cannot lower to a
        // conditional, and why `(a?.b)(d)` keeps its receiver through a
        // `|!()` step instead of completing a `['?.', …]` node that would
        // hand on an ordinary value.
        desugaredOptional: () => {
            assertEq(desugarOptionalAt(null), undefined)
            assertEq(desugarOptionalAt(undefined), undefined)
            // Identity, not just equality: a receiver-bound function (e.g.
            // `o.at.bind(o)`) is `!==` to `[42].at` even though it behaves
            // the same on `(0)`. So this line and `throw.desugaredOptional`
            // both redden under that mutation — the identity check here,
            // the call there.
            assertEq(desugarOptionalAt([42]), [42].at)
        },
        throw: {
            // `const at = a.at; at(0)` — the value without its receiver,
            // the case that makes receiver state part of what a graph means.
            detachedReceiver: () => {
                const at = [42].at
                return at(0)
            },
            // The desugaring above, called: `42` through `(a?.at)(0)`
            // (`receiver` in `./proof.f.js`), a throw once a conditional has
            // made it a value.
            desugaredOptional: () => desugarOptionalAt([42])(0),
        },
    },
}
