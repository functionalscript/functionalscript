/**
 * Execution semantics of `vm` — one section per operand shape, since that is
 * how `map`'s handlers are built (`o1`/`o2`/`o2lazy`), plus the nodes that
 * evaluate their operands themselves (`,`, `[]`, `{}`, and the chain nodes
 * `()`, `.()`, `?.`, `?.()`, `_`, and `_()`). Nothing is `todo` any more.
 * This is the executing counterpart of `../proof.f.mjs`, which pins what the
 * schema *accepts*; nothing here validates.
 *
 * Every chain graph below is minimal in the sense of
 * `../canonical/module.f.mjs` — the spelling a lowering is allowed to emit —
 * so the semantics pinned here are the semantics of legal EDAGs, not of
 * shapes the schema merely tolerates.
 *
 * @import { Exp } from '../types.ts'
 * @import { Context } from './types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Array as ExpArray, Call, Op1, Op2, OptionChain } from '../types.ts'
 * @import { Get } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm } from './module.f.mjs'

// `TagMap` exists so a dispatcher generic over `K` sees one handler
// signature; these pin the tag -> node-tuple correlation it is built on,
// including the tags whose node kinds are not `op1`/`op2`.
/** @typedef {Assert<Equal<Get<'+'>, Op2>>} _PlusIsOp2 */
/** @typedef {Assert<Equal<Get<'neg'>, Op1>>} _NegIsOp1 */
/** @typedef {Assert<Equal<Get<'[]'>, ExpArray>>} _BracketsIsArray */
/** @typedef {Assert<Equal<Get<'()'>, Call>>} _CallIsCall */
/** @typedef {Assert<Equal<Get<'_'>, OptionChain>>} _UnderscoreIsOptionChain */

/** @type {Context} */
const context = { frame: { x: 1 }, args: [10, 20] }

/** @type {(e: Exp) => unknown} */
const ev = e => vm(context)(e)

/** `ev` composed with `assertEq`, the shape almost every case below has. */
/** @type {(e: Exp, expected: unknown) => void} */
const eq = (e, expected) => { assertEq(ev(e), expected) }

/** The same for a value built by the node rather than passed through it. */
/** @type {(e: Exp, expected: unknown) => void} */
const same = (e, expected) => { assertStructurallySame(ev(e), expected) }

/**
 * An operand that throws when evaluated — `null['x']` — so a case can claim
 * "this operand is *not* evaluated" by the test simply passing. The
 * `throw` section calls its forced counterparts.
 * @type {Exp}
 */
const boom = ['.', null, 'x']

/**
 * `a => a` with an empty frame — the smallest callable, used wherever a
 * case is about the call and not about what the callee computes.
 * @type {Exp}
 */
const identity = ['=>', ['[]', []], ['.', ['args'], 0]]

/** `(...a) => a` — hands back the whole argument array. @type {Exp} */
const argsNode = ['=>', ['[]', []], ['args']]

/**
 * `() => (a => a)` — one call away from `identity`, so a chain can spend a
 * call step and still have something to call.
 * @type {Exp}
 */
const constIdentity = ['=>', ['[]', []], identity]

/**
 * `{ id: a => a, args: (...a) => a, f: () => (a => a), o: { id: a => a } }`
 * — a receiver for the property steps, holding a callee at depth one and at
 * depth two. Its methods are `=>` closures, so none of them can observe the
 * `this` a step hands over; the receiver cases use a host method for that.
 * @type {Exp}
 */
const methods = ['{}', [
    [':', 'id', identity],
    [':', 'args', argsNode],
    [':', 'f', constIdentity],
    [':', 'o', ['{}', [[':', 'id', identity]]]],
]]

/** `() => methods` — a chain starting with a call step needs one. @type {Exp} */
const constMethods = ['=>', ['[]', []], methods]

/** `[42]`, whose `at` is a host method and so observes its receiver. @type {Exp} */
const box = ['[]', [42]]

/** `{ b: { c: 7 } }` — two property steps' worth of ordinary value. @type {Exp} */
const deep = ['{}', [[':', 'b', ['{}', [[':', 'c', 7]]]]]]

export const proof = {
    // The non-`Array` side of `vm`'s only branch: a primitive is its own
    // value, returned without ever reaching `map`.
    primitive: () => {
        eq(1, 1)
        eq('a', 'a')
        eq(null, null)
        eq(true, true)
        eq(false, false)
        eq(1n, 1n)
    },
    // `op0` — the three handlers that read `context` instead of operands.
    // `undefined` is a node, not the bare value (see `Primitive`).
    op0: () => {
        eq(['undefined'], undefined)
        eq(['frame'], context.frame)
        eq(['args'], context.args)
        // ... and `context` is threaded, not defaulted: another one is seen.
        /** @type {Context} */
        const other = { frame: 'f', args: [] }
        assertEq(vm(other)(['frame']), 'f')
        assertStructurallySame(vm(other)(['args']), [])
    },
    // `o1` — one evaluated operand.
    op1: () => {
        eq(['!', 0], true)
        eq(['!', 1], false)
        eq(['~', 0], -1)
        eq(['neg', 5], -5)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
    },
    // `o2` — both operands evaluated. Each case asserts a *value*, which is
    // what pins the whole group against `o2` wrapping another `(c, e) =>`
    // around `o2lazy`: that returns the handler uncalled, so every binary
    // operator would evaluate to a function rather than to a result.
    op2: () => {
        eq(['+', 2, 3], 5)
        eq(['-', 2, 3], -1)
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['!==', 2, 3], true)
        eq(['<', 2, 3], true)
        eq(['<=', 3, 3], true)
        eq(['>', 2, 3], false)
        eq(['>=', 3, 3], true)
        eq(['&', 6, 3], 2)
        eq(['|', 6, 3], 7)
        eq(['^', 6, 3], 5)
        eq(['<<', 1, 3], 8)
        eq(['>>', -8, 1], -4)
        eq(['>>>', -1, 31], 1)
    },
    // `.` and `own` are `o2` too, but they read a property rather than
    // combine two numbers, and they differ on the prototype chain.
    property: () => {
        eq(['.', ['[]', [1, 2, 3]], 1], 2)
        eq(['.', ['{}', [[':', 'a', 7]]], 'a'], 7)
        eq(['own', ['{}', [[':', 'a', 7]]], 'a'], 7)
        // Absent: no descriptor, so `?.value` is `undefined` rather than a
        // read of `undefined.value`.
        eq(['own', ['{}', []], 'a'], undefined)
        // Inherited: `.` walks the prototype chain and `own` does not —
        // the whole reason `own` is a separate node.
        eq(['own', ['{}', []], 'toString'], undefined)
        // A key that is a string only after JS coercion is not a string key:
        // `own`'s key operand must *evaluate* to one, so `1` is rejected
        // rather than silently reading `'1'` — see `throw.ownNonStringKey`.
        eq(['own', ['{}', [[':', '1', 42]]], '1'], 42)
        assert(typeof ev(['.', ['{}', []], 'toString']) === 'function')
    },
    // `o2lazy` — the right operand is a thunk, so these three short-circuit.
    // Each case that claims "not evaluated" uses `boom`, which throws if it
    // is; `throw.forced` calls the same nodes with the other left operand.
    lazy: () => {
        eq(['&&', false, boom], false)
        eq(['&&', true, 7], 7)
        eq(['||', true, boom], true)
        eq(['||', false, 7], 7)
        eq(['??', 0, boom], 0)
        eq(['??', null, 7], 7)
    },
    // `,` — every operand evaluated in order, the last one is the value.
    comma: () => {
        eq([',', [1, 2, 3]], 3)
        // No operands: the `reduce` seed is the result.
        eq([',', []], undefined)
        eq([',', [['+', 1, 1]]], 2)
    },
    // `[]` — an item is spread only when it is an array tagged `'...'`, so
    // all three shapes an item can have appear here: a primitive (not an
    // array), a tagged node that is not a spread, and a spread.
    array: () => {
        same(['[]', []], [])
        same(['[]', [1, ['+', 1, 1], ['...', ['[]', [3, 4]]]]], [1, 2, 3, 4])
        // A spread of an empty array contributes nothing.
        same(['[]', [['...', ['[]', []]], 1]], [1])
        // The operand is *iterated*, not spliced in as one element, so a
        // string contributes its characters — `[...'ab']` is `['a', 'b']`.
        same(['[]', [['...', 'ab']]], ['a', 'b'])
    },
    // `{}` — `:` builds one entry from two evaluated operands, `'...'`
    // takes the own enumerable entries of an evaluated object.
    object: () => {
        same(['{}', []], {})
        same(['{}', [[':', 'a', 1], [':', ['String', 'b'], ['+', 1, 1]]]], { a: 1, b: 2 })
        same(
            ['{}', [[':', 'a', 1], ['...', ['{}', [[':', 'b', 2]]]]]],
            { a: 1, b: 2 },
        )
        // Later entries win, as in JavaScript's own object literal.
        same(['{}', [[':', 'a', 1], ['...', ['{}', [[':', 'a', 2]]]]]], { a: 2 })
        // Object spread takes whatever own enumerable properties the operand
        // has, and most values have none — a nullish one contributes nothing
        // rather than throwing, which is where it parts from array spread.
        same(['{}', [['...', null]]], {})
        same(['{}', [['...', ['undefined']]]], {})
        same(['{}', [['...', 1]]], {})
        same(['{}', [['...', true]]], {})
        // ... and a string contributes its indices.
        same(['{}', [['...', 'ab']]], { 0: 'a', 1: 'b' })
    },
    // Operands are evaluated through `vm(context)`, so a node composes with
    // every other node kind and sees the same context at any depth.
    nested: () => {
        eq(['+', ['+', 1, 2], 3], 6)
        eq(['.', ['args'], 1], 20)
        eq(['.', ['frame'], 'x'], 1)
        same(
            ['{}', [[':', 'a', ['[]', [['.', ['args'], 0], ['neg', 1]]]]]],
            { a: [10, -1] },
        )
    },
    // `=>` evaluates its *frame* operand and not its body: the value is the
    // captured frame paired with the body graph, which is why a closure can
    // outlive the scope that built it. Here that pair is a host function, so
    // these also pin that representation choice — a `typeof`-`'function'`
    // value the host can call directly, not an inert record.
    lambda: () => {
        const f = ev(identity)
        assertEq(typeof f, 'function')
        assertEq(/**@type {(a: unknown) => unknown}*/(f)(7), 7)
        // Every evaluation builds a fresh closure, as `x => x` does in JS —
        // the `=>` node is shared, the values it produces are not.
        assert(ev(identity) !== ev(identity))
    },
    // `()` — a call with **no** receiver, which is the whole of what its tag
    // says. A call rebuilds the callee's scope from two places: `frame` comes
    // from the closure, `args` from the call site.
    call: () => {
        eq(['()', identity, ['[]', [7]]], 7)
        // The args operand is one node evaluating to the complete argument
        // array, so `['args']` in the callee *is* that array — not the array
        // wrapped in another one, and not just its first element.
        same(['()', argsNode, ['[]', [5, 6]]], [5, 6])
        same(['()', argsNode, ['[]', []]], [])
        // ... and any node evaluating to an array serves, which is what
        // makes `f(...xs)` need no `...` node: the whole array passes through.
        same(['()', argsNode, ['[]', [1, ['...', ['[]', [2, 3]]]]]], [1, 2, 3])
        // Operands are evaluated in the *caller's* scope, before the callee's
        // exists: the callee expression as much as the arguments.
        eq(['()', ['.', ['[]', [identity]], 0], ['[]', [['+', 3, 4]]]], 7)
    },
    // `.()` — the one non-optional node carrying hidden control flow: the
    // base is the receiver, so the property is read and called without ever
    // becoming a detached value. `throw.detachedReceiver` is the same read
    // through a `.` node, which loses it.
    dotCall: () => {
        // The receiver is real rather than bookkeeping: `[42].at(0)` is `42`
        // only because `at` is called *on* the array.
        eq(['.()', box, 'at', ['[]', [0]]], 42)
        eq(['.()', methods, 'id', ['[]', [7]]], 7)
        // The args operand is still one node evaluating to the whole
        // argument array: a receiver changes what is called, not how.
        same(['.()', methods, 'args', ['[]', [5, 6]]], [5, 6])
        same(['.()', methods, 'args', ['[]', []]], [])
        // An `index` is a string, a number, or `['Number', exp]` — the three
        // forms `.` takes, evaluated the same way.
        eq(['.()', ['[]', [identity]], 0, ['[]', [7]]], 7)
        eq(['.()', ['[]', [identity]], ['Number', '0'], ['[]', [7]]], 7)
        // A call ends a receiver's lifetime, so nothing extends `.()`:
        // longer non-optional chains supply its base instead.
        eq(['.()', ['.', methods, 'o'], 'id', ['[]', [7]]], 7) // a.b.c(...d)
        eq(['.()', ['()', constMethods, ['[]', []]], 'id', ['[]', [7]]], 7) // a(...b).c(...d)
    },
    // `?.` — a region of exactly one step: it guards its *input*, skips its
    // own `index` on the nullish branch, and skips nothing else.
    optionDot: () => {
        eq(['?.', ['{}', [[':', 'a', 7]]], 'a'], 7)
        // A closure is a value like any other — compared by `typeof`, since
        // every evaluation of a `=>` builds a fresh one (see `lambda`).
        assert(typeof ev(['?.', methods, 'id']) === 'function')
        eq(['?.', ['[]', [1, 2, 3]], 1], 2)
        eq(['?.', ['[]', [1, 2, 3]], ['Number', '1']], 2)
        // An absent property is `undefined`, not an error: `?.` guards its
        // *input*, never its result.
        eq(['?.', ['{}', []], 'absent'], undefined)
        // ... and on a nullish input the node is `undefined`, both ways of
        // being nullish, with the index left unevaluated — the operand
        // `../proof.f.mjs`'s `chainsJs.shortCircuit` pins as `u?.[todo()]`.
        eq(['?.', ['undefined'], ['Number', boom]], undefined)
        eq(['?.', null, ['Number', boom]], undefined)
        // a?.b?.c — a second `?.` over the first, since neither region
        // reaches past its own operand.
        eq(['?.', ['?.', deep, 'b'], 'c'], 7)
    },
    // `?.()` — the same one-step region, the step being an optional call of
    // a *value*: no property precedes it, so there is no receiver, which is
    // what `throw.optionCallIsReceiverLess` pins.
    optionCall: () => {
        eq(['?.()', identity, ['[]', [7]]], 7)
        same(['?.()', argsNode, ['[]', [5, 6]]], [5, 6])
        // A nullish callee is the node's value, and the arguments are not
        // evaluated. Both ways of being nullish.
        eq(['?.()', ['undefined'], boom], undefined)
        eq(['?.()', null, boom], undefined)
        // (f?.(...a))?.(...b) — a second node, because a call step clears
        // the receiver and closing the region before a guarded operator is
        // unobservable.
        eq(['?.()', ['?.()', constIdentity, ['[]', []]], ['[]', [7]]], 7)
    },
    // The `lambda` steps, walked by `_`. A step is a function of the current
    // chain value with its argument elided — `../README.md`, "Chains" — so
    // it can be neither an `exp` nor shared, and the receiver and the
    // short-circuit exist only while the chain is being walked. One case
    // group per step id.
    chain: {
        // `['|?.', index]` opening a region and `['|.', index]` continuing
        // it: `a?.b.c`, one node, where the `.c` is skipped on a nullish `a`
        // rather than run on `undefined`.
        propertyStep: () => {
            eq(['_', deep, [['|?.', 'b'], ['|.', 'c']]], 7)
            eq(['_', methods, [['|?.', 'o'], ['|.', 'id'], ['|()', ['[]', [7]]]]], 7)
        },
        // `['|()', exp]` — a call step: call the current value with the
        // current receiver, then *clear* it. `a?.b(...c)` is `42` only if
        // `at` is called on the array, and `a?.b(...c).d(...e)` needs the
        // second property step to make a receiver of its own.
        callStep: () => {
            eq(['_', box, [['|?.', 'at'], ['|()', ['[]', [0]]]]], 42)
            eq(['_', 'ab', [
                ['|?.', 'at'],
                ['|()', ['[]', [0]]],
                ['|.', 'toUpperCase'],
                ['|()', ['[]', []]],
            ]], 'A')
        },
        // `['|?.()', exp]` in its two roles. **Bound** to the property step
        // ahead of it, which supplies the receiver it consumes — `a.b?.(...c)`,
        // where cutting before the step would call a detached `a.b`. And
        // **opening** the region itself, needing no receiver and no property
        // step — `a?.(...b)(...c)`, where a nullish `a` skips both argument
        // lists.
        optionCallStep: () => {
            eq(['_', box, [['|.', 'at'], ['|?.()', ['[]', [0]]]]], 42)
            eq(['_', box, [['|?.', 'at'], ['|?.()', ['[]', [0]]]]], 42)
            eq(['_', constIdentity, [['|?.()', ['[]', []]], ['|()', ['[]', [7]]]]], 7)
        },
        // The short-circuit, which is the region's whole reason to exist: it
        // returns rather than throws, so the skip is directly observable,
        // operands included. `boom` as a skipped step's index would throw if
        // that step ran.
        shortCircuit: () => {
            eq(['_', ['undefined'], [['|?.', 'at'], ['|.', ['Number', boom]]]], undefined)
            eq(['_', null, [['|?.', 'at'], ['|.', ['Number', boom]]]], undefined)
            // The skipped steps' operands are not evaluated either — a call
            // step's arguments as much as a property step's index.
            eq(['_', ['undefined'], [['|?.', 'at'], ['|()', boom]]], undefined)
            // A link mid-region short-circuits the same way: here `a.b` is
            // `undefined`, so the `|?.()` bound to it skips itself and
            // everything after it.
            eq(['_', ['{}', [[':', 'b', ['undefined']]]], [
                ['|.', 'b'],
                ['|?.()', boom],
                ['|.', ['Number', boom]],
            ]], undefined)
        },
        throw: {
            // A step is only as good as what it lands on: a property step
            // onto a value that is not callable reaches the same host
            // `TypeError` as `throw.callNonFunction`, one node earlier.
            propertyStepOnNonFunction: () =>
                ev(['_', ['{}', [[':', 'a', 1]]], [['|?.', 'a'], ['|()', ['[]', []]]]]),
            // `?.()` guards against a *nullish* callee, not a non-callable
            // one, inside a region as much as on its own node.
            optionCallStepOnNonFunction: () =>
                ev(['_', ['{}', [[':', 'a', 1]]], [['|.', 'a'], ['|?.()', ['[]', []]]]]),
            // The mirror of `shortCircuit`: with a non-nullish input the
            // same operands *are* evaluated.
            evaluatedIndex: () =>
                ev(['_', ['{}', []], [['|?.', 'a'], ['|.', ['Number', boom]]]]),
        },
    },
    // `_()` — the same walk with the region's value *called*, using the
    // receiver its last step left. It is the only unguarded consumer of a
    // receiver, which is why a leading optional step is observable here.
    optionChainCall: () => {
        // (a?.b)(...c) — the receiver survives the optional step, so a host
        // method still runs on its object.
        eq(['_()', box, [['|?.', 'at']], ['[]', [0]]], 42)
        // (a?.b.c)(...d) — the `|?.` sits inside the region the call
        // consumes, and moving it into the base would change the expression.
        eq(['_()', methods, [['|?.', 'o'], ['|.', 'id']], ['[]', [7]]], 7)
    },
    // The pairs that differ only in where a region ends or whether a
    // receiver survives — each a fact that would break silently under a
    // later "simplification", so each is pinned by a value on one side and a
    // throw on the other, or by both sides being spelled and run.
    distinguished: {
        // `a.b(...c)` against `(0, a.b)(...c)`: the receiver and its
        // absence, told apart by the **tag**. The `.()` reading is the value
        // below; the `()` reading is `throw.receiverErased`.
        receiver: () => {
            eq(['.()', box, 'at', ['[]', [0]]], 42)
        },
        // `(a?.b.c)(...d)` against `((a?.b).c)(...d)`. On a non-nullish base
        // they agree; on a nullish one both throw, but at different points —
        // the walker short-circuits, evaluates the arguments, and throws at
        // the call, while the `.()` throws at the access with its arguments
        // unevaluated. Both sides are under `throw` below.
        regionAcrossAProperty: () => {
            eq(['_()', methods, [['|?.', 'o'], ['|.', 'id']], ['[]', [7]]], 7)
            eq(['.()', ['?.', methods, 'o'], 'id', ['[]', [7]]], 7)
        },
        // `(a?.b.c)?.(...d)` against `((a?.b).c)?.(...d)` — the same pair
        // with the final call guarded, which is what makes the difference a
        // *value*: the first short-circuits the whole region, the second
        // closed it before the `.c` and reads a property of `undefined`.
        regionAcrossAPropertyGuarded: () => {
            eq(['_', ['undefined'], [
                ['|?.', 'o'],
                ['|.', 'id'],
                ['|?.()', boom],
            ]], undefined)
        },
        // A trailing region moved outside its node: `a?.b?.(...c).d` is one
        // walker and `(a?.b?.(...c)).d` is a `.` over a shorter one. On a
        // nullish base the first is `undefined` and the second throws.
        trailingRegion: () => {
            eq(['_', ['undefined'], [
                ['|?.', 'at'],
                ['|?.()', boom],
                ['|.', ['Number', boom]],
            ]], undefined)
        },
        throw: {
            // `(0, a.b)(...c)` — `const at = a.at; at(0)`. The receiver a
            // `.()` node keeps is exactly what reading the same property as
            // a `.` node drops, and the host method is strict, so the
            // detached call throws.
            receiverErased: () => ev(['()', ['.', box, 'at'], ['[]', [0]]]),
            // `((a.at)(0))(0)` — the same detachment reached through a call
            // step, so the callee is a bare value rather than an accessor.
            // A host method is what makes that observable: an `=>` closure
            // ignores whatever `this` it is handed, so only this spelling
            // catches a receiver *invented* for a bare value — which is what
            // `p[0](...)` in `call` did, returning `Array.prototype.at` where
            // JavaScript throws. See `call` in `./module.f.mjs`.
            receiverErasedAfterCall: () =>
                ev(['()', ['.()', box, 'at', ['[]', [0]]], ['[]', [0]]]),
            // `?.()` is an optional call of a value and never a method call:
            // a detached `a.b` handed to it runs with no receiver.
            optionCallIsReceiverLess: () => ev(['?.()', ['.', box, 'at'], ['[]', [0]]]),
            // `(a?.b.c)(...d)` on a nullish base: the region short-circuits,
            // so `undefined` is what the node's own call calls.
            regionCallOnUndefined: () =>
                ev(['_()', ['undefined'], [['|?.', 'o'], ['|.', 'id']], ['[]', [7]]]),
            regionCallOnNull: () =>
                ev(['_()', null, [['|?.', 'o'], ['|.', 'id']], ['[]', [7]]]),
            // ... and `((a?.b).c)(...d)`, the grouped counterpart, which
            // closed the region first and so reads `.c` of `undefined`.
            groupedRegionCall: () =>
                ev(['.()', ['?.', ['undefined'], 'o'], 'id', ['[]', [7]]]),
            // The guarded half of the same pair: `((a?.b).c)?.(...d)` still
            // throws, because a guard on the *call* cannot undo a closure
            // that already exposed `.c` to `undefined` — which is what makes
            // `(a?.b.c)?.(...d)` above a value rather than a throw.
            groupedRegionGuardedCall: () =>
                ev(['_', ['?.', ['undefined'], 'o'], [['|.', 'id'], ['|?.()', boom]]]),
            // `(a?.b?.(...c)).d` — the trailing `.d` moved outside the
            // region runs on the `undefined` the region produced.
            trailingRegionOutside: () =>
                ev(['.', ['_', ['undefined'], [['|?.', 'at'], ['|?.()', boom]]], 'd']),
            // The region's value is not callable: `_()` consumes it with an
            // unguarded call, so an absent property is a host `TypeError`
            // rather than an `undefined`.
            regionCallOnAbsentProperty: () =>
                ev(['_()', ['{}', []], [['|?.', 'absent']], ['[]', []]]),
        },
    },
    // The frame is the only channel outward: a body's leaves are constants,
    // `['args']` and `['frame']`, so a captured value has to arrive as data.
    closure: () => {
        // `['=>', ['[]', [100]], …]` captures `100` at closure-creation time.
        eq(['()', ['=>', ['[]', [100]], ['+', ['.', ['args'], 0], ['.', ['frame'], 0]]],
            ['[]', [5]]], 105)
        // Nested: the outer call's argument is copied into the inner frame,
        // and the inner body reads it as `['frame']` — the same node
        // `['.', ['args'], 0]` could not have been shared across the `=>`.
        const outer = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]],
        ])
        eq(['()', ['()', outer, ['[]', [7]]], ['[]', []]], 7)
        // The frame operand is evaluated in the enclosing scope, so it sees
        // that scope's `['args']` — the one place a `=>` node reaches out.
        assertEq(vm({ frame: null, args: [11] })(
            ['()', ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]], ['[]', []]]),
            11)
    },
    // Closures are ordinary values: passable as arguments, returnable, and
    // callable from a node that computed them rather than named them.
    higherOrder: () => {
        // `(g, x) => g(x)`
        const apply = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['()', ['.', ['args'], 0], ['[]', [['.', ['args'], 1]]]],
        ])
        eq(['()', apply, ['[]', [identity, 7]]], 7)
        // `x => y => x + y`, applied twice — the classic case the frame
        // exists for.
        const add = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['=>', ['[]', [['.', ['args'], 0]]],
                ['+', ['.', ['frame'], 0], ['.', ['args'], 0]]],
        ])
        eq(['()', ['()', add, ['[]', [2]]], ['[]', [3]]], 5)
    },
    throw: {
        // The index of a `?.` whose input is *not* nullish is evaluated, the
        // mirror of `optionDot`'s skipped operands.
        evaluatedIndex: () => ev(['?.', ['{}', []], ['Number', boom]]),
        // ... and so are an optional call's arguments once its callee turns
        // out to be there.
        evaluatedArgument: () => ev(['?.()', identity, boom]),
        // `?.()` guards against a *nullish* callee, not against a
        // non-callable one: `1?.()` is the host `TypeError`, exactly as
        // `throw.callNonFunction` is for `()`.
        optionCallOnNonFunction: () => ev(['?.()', 1, ['[]', []]]),
        // An array spread iterates its operand, so a non-iterable one throws
        // where the object form would have contributed nothing.
        arraySpreadOfNumber: () => ev(['[]', [['...', 1]]]),
        arraySpreadOfNull: () => ev(['[]', [['...', null]]]),
        // `own`'s key operand must evaluate to a string, and `ToPropertyKey`
        // coercion is exactly what that rules out.
        ownNonStringKey: () => ev(['own', ['{}', [[':', '1', 42]]], 1]),
        // Not a function: `()` calls whatever the callee operand evaluates
        // to, so this is the host `TypeError`, not a check of its own.
        callNonFunction: () => ev(['()', 1, ['[]', []]]),
        // The other side of `lazy`: with the left operand that does not
        // short-circuit, the thunk *is* forced and `boom` throws. Without
        // these, `o2lazy` returning `a` unconditionally would still pass.
        forcedAnd: () => ev(['&&', true, boom]),
        forcedOr: () => ev(['||', false, boom]),
        forcedCoalesce: () => ev(['??', null, boom]),
        // ... and `o2` forces it with no short-circuit to begin with.
        forcedEager: () => ev(['+', 1, boom]),
    },
}
