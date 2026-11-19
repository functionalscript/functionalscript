/**
 * The JavaScript the chain nodes of `./module.f.js` have to agree with, run on
 * the host engine: what the vocabulary denotes, not what the schema accepts.
 * `./proof.f.js`'s `chains` pins the shape of every spelling here.
 *
 * These cases read a method as a value (`a.at` without a call), which
 * FunctionalScript does not, so they are kept apart from `./proof.f.js`.
 */

import { assertEq, todo } from '../asserts/module.f.js'

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

// The JS these nodes have to agree with, run on the host engine — the
// `ownJs` pattern one level up: what the vocabulary denotes, not what the
// schema accepts. Every spelling here is one `chains` pins the shape of,
// and each is why that shape is what it is. `todo()` always throws, so it
// doubles as an evaluation probe: reaching it is observable without any
// mutation, and a case that returns instead proves the operand was
// skipped.
export const proof = {
    chainsJs: {
        // Receiver: a property reference carries its base into the call as
        // `this`, and parentheses around the reference do not break that —
        // only detaching the value does (`throw.detachedReceiver`). It holds
        // across an optional link too, which is why `(a?.b)(d)` is a `?.`
        // node with a `|!()` continuation, `['?.', a, 'b', ['|!()', d]]`,
        // rather than a `()` over a complete `['?.', a, 'b']`: the
        // latter would produce an ordinary value and lose the receiver.
        receiver: () => {
            const a = [42]
            assertEq(a.at(0), 42)
            assertEq((a.at)(0), 42)
            assertEq((a?.at)(0), 42) // ['?.', a, 'at', ['|!()', …]]
            assertEq((a?.at)?.(0), 42) // ['?.', a, 'at', ['|?.()', …]]
            assertEq(a.at?.(0), 42) // ['.', a, 'at', ['|?.()', …]]
            assertEq(a?.at?.(0), 42) // ['?.', a, 'at', ['|?.()', …]]
        },
        // Short-circuit: a nullish link skips the rest of its chain, and
        // grouping is what ends that chain — `u?.at.name` is `undefined`
        // where `(u?.at).name` throws (`throw.groupedOptional`), one
        // continuation against two nodes.
        shortCircuit: () => {
            /** @type {any} */
            const u = undefined
            assertEq(u?.at, undefined)
            assertEq(u?.at.name, undefined) // ['?.', u, 'at', ['|.', 'name']]
            assertEq(u?.at?.(0), undefined)
            // The operands on the skipped branch are never evaluated: an
            // optional property's index, and an optional call's arguments.
            assertEq(u?.[todo()], undefined)
            assertEq(u?.(todo()), undefined)
        },
        // The quiet half of `throw.groupedOptional`: a group ends the chain,
        // but when what follows is itself guarded the ending is unobservable.
        // That is the parenthesis law's own escape clause, and the reason
        // `null` is the right spelling of a bare `(a?.b)`.
        grouping: () => {
            /** @type {any} */
            const u = undefined
            assertEq((u?.at)?.name, undefined)
            assertEq((u?.at)?.(0), undefined)
        },
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
        // The two spellings that differ *only* in whether the arguments ran —
        // `a.b(...c)` throws at the access with `c` untouched, `(a?.b)(...c)`
        // short-circuits, evaluates `c`, and throws at the call — cannot be
        // pinned here, nor by the node either: both readings throw, and a
        // `throw` case is pass/fail rather than payload-inspecting. What
        // carries that order is the shape of `callProperty` in
        // `./amnesia/module.f.js`; "Where the host engines disagree" in
        // `./README.md` states the gap. Nor can `(u?.at)(0)` be pinned: both are
        // `|!()` terms, JavaScriptCore (so `bun test`) carries the
        // short-circuit through the parentheses and answers `undefined` where
        // V8 throws, so asserting either answer would redden a runner. The
        // node is unaffected — `['?.', u, 'at', ['|!()', …]]` means the
        // throwing reading — and `optionRegion.throw.closeStepOnUndefined` in
        // `./amnesia/proof.f.js` pins it by evaluating the node, which is
        // the only oracle that works on every runner. See "Chains" in
        // `./README.md`. `throw.groupedOptional` below pins the same boundary
        // through a property access, where every engine agrees.
        throw: {
            // `const at = a.at; at(0)` — the value without its receiver,
            // the case that makes receiver state part of what a graph means.
            detachedReceiver: () => {
                const at = [42].at
                return at(0)
            },
            // The desugaring above, called: `42` through `(a?.at)(0)`
            // (`receiver`), a throw once a conditional has made it a value.
            desugaredOptional: () => desugarOptionalAt([42])(0),
            // `(u?.at).name` — the parens ended the optional chain, so
            // `.name` runs on `undefined` instead of being skipped.
            groupedOptional: () => {
                /** @type {any} */
                const u = undefined
                return (u?.at).name
            },
            // The mirror of `shortCircuit`'s last two: on a non-nullish
            // input those same operands *are* evaluated.
            evaluatedIndex: () => [42]?.[todo()],
            evaluatedArgument: () => [42].at?.(todo()),
            // `(u?.(0))(1)` — the inner call already cleared the receiver, so
            // the group's boundary carries nothing and every runner agrees.
            // That is also why the grammar has no `|!()` in `optionLambda`:
            // this is a plain `()` over a complete `?.()` node.
            groupedOptionalCallOfCall: () => {
                /** @type {any} */
                const u = undefined
                return (u?.(0))(1)
            },
            // Two shapes bun answers differently, so neither can be
            // asserted. Both throw everywhere else; see "Chains" in
            // `./README.md` for which is the engine and which is the
            // transpiler, and
            // `../../todo/blocked/bun-optional-chain-parentheses.md` for what
            // unblocks them. The second must stay commented rather than merely
            // fail: bun rejects it at parse, taking the file down.
            //
            // groupedOptionalCall: () => {
            //     /** @type {any} */
            //     const u = undefined
            //     return (u?.at)(0)
            // },
            //
            // groupedOptionalTag: () => {
            //     /** @type {any} */
            //     const u = undefined
            //     return (u?.at)`tag`
            // },
        },
    },
}
