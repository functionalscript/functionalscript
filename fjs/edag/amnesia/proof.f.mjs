/**
 * Execution semantics of `vm` — one section per operand shape, since that is
 * how `map`'s handlers are built (`o1`/`o2`/`o2lazy`), plus the nodes that
 * evaluate their operands themselves (`,`, `[]`, `{}`, and the four chain
 * nodes — `()`, `.`, `?.`, and `?.()`). Nothing is `todo` any more.
 * This is the executing counterpart of `../proof.f.mjs`, which pins what the
 * schema *accepts*; nothing here validates.
 *
 * @import { Exp } from '../types.ts'
 * @import { Context } from './types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Array as ExpArray, Call, Dot, Index, Op1, Op2 } from '../types.ts'
 * @import { Get } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm } from './module.f.mjs'

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
 * The same, in a naming position: an `index` is a `string`, a `number`, or a
 * `Number` cast, so this is how a skipped step's *index* is made observable.
 * @type {Index}
 */
const boomIndex = ['Number', boom]

/** `['undefined']`, the node — the nullish input every guard is about. @type {Exp} */
const undef = ['undefined']

/** `[]` as an argument list, for a call whose arguments are beside the point. @type {Exp} */
const noArgs = ['[]', []]

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
 * `this` a step hands over; `chain.receiver` uses a host method for that.
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

export const proof = {
    // `TagMap` exists so a dispatcher generic over `K` sees one handler
    // signature; these pin the tag -> node-tuple correlation it is built on,
    // including the tags whose node kinds are not `op1`/`op2`.
    tagMap: () => {
        /** @typedef {Assert<Equal<Get<'+'>, Op2>>} _PlusIsOp2 */
        /** @typedef {Assert<Equal<Get<'neg'>, Op1>>} _NegIsOp1 */
        /** @typedef {Assert<Equal<Get<'[]'>, ExpArray>>} _BracketsIsArray */
        /** @typedef {Assert<Equal<Get<'()'>, Call>>} _CallIsCall */
        /** @typedef {Assert<Equal<Get<'.'>, Dot>>} _DotIsDot */
    },
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
        eq(undef, undefined)
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
    // `.` with no continuation operand is the plain read — the receiver it
    // produced is dropped, exactly as reading `a.b` for its value drops it.
    // `own` is the `o2` next to it, and they differ on the prototype chain.
    property: () => {
        eq(['.', ['[]', [1, 2, 3]], 1], 2)
        eq(['.', ['{}', [[':', 'a', 7]]], 'a'], 7)
        // An `index` is a string, a number, or `['Number', exp]`, and all
        // three name a property the same way.
        eq(['.', ['[]', [1, 2, 3]], ['Number', '1']], 2)
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
        same(['{}', [['...', undef]]], {})
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
    // `()` — the call with no receiver and no region. A call rebuilds the
    // callee's scope from two places: `frame` comes from the closure, `args`
    // from the call site.
    call: () => {
        eq(['()', identity, ['[]', [7]]], 7)
        // The args operand is one node evaluating to the complete argument
        // array, so `['args']` in the callee *is* that array — not the array
        // wrapped in another one, and not just its first element.
        same(['()', argsNode, ['[]', [5, 6]]], [5, 6])
        same(['()', argsNode, noArgs], [])
        // ... and any node evaluating to an array serves, which is what
        // makes `f(...xs)` need no `...` node: the whole array passes through.
        same(['()', argsNode, ['[]', [1, ['...', ['[]', [2, 3]]]]]], [1, 2, 3])
        // Operands are evaluated in the *caller's* scope, before the callee's
        // exists: the callee expression as much as the arguments.
        eq(['()', ['.', ['[]', [identity]], 0], ['[]', [['+', 3, 4]]]], 7)
    },
    // The continuation of a `.` node — `propertyLambda`, the state with a
    // live receiver and no region around it. A step is a function of the
    // chain's current value with its argument elided (`../README.md`,
    // "Chains"), so it can be neither an `exp` nor shared, and the receiver
    // exists only while the chain is being walked. Only the two call steps
    // are here, because only a call spends a receiver.
    chain: {
        // `['|()', exp]` — the terminal call step. The value called is
        // the property, and the object it came from is the receiver
        // (`receiver`, below).
        callStep: () => {
            // a.b(...c)
            eq(['.', methods, 'id', ['|()', ['[]', [7]]]], 7)
            // (a.b.c)(...d) — a plain property path nests, and a non-optional
            // chain means the same parenthesized or not.
            eq(['.', ['.', methods, 'o'], 'id', ['|()', ['[]', [7]]]], 7)
            // The args operand is still one node evaluating to the whole
            // argument array: a chain changes what is called, not how it is
            // called.
            same(['.', methods, 'args', ['|()', ['[]', [5, 6]]]], [5, 6])
            same(['.', methods, 'args', ['|()', noArgs]], [])
            // The three `index` forms, in the naming position of the node
            // that owns the call.
            eq(['.', ['[]', [identity]], 0, ['|()', ['[]', [7]]]], 7)
            eq(['.', ['[]', [identity]], ['Number', '0'], ['|()', ['[]', [7]]]], 7)
        },
        // `['|?.()', exp, k]` — the guarded call step: it spends the receiver
        // and *opens* a region, so unlike `|()` it carries a continuation.
        // With a non-nullish value it behaves exactly as `|()` does.
        optionCallStep: () => {
            // a.b?.(...c)
            eq(['.', methods, 'id', ['|?.()', ['[]', [7]]]], 7)
            // a.b?.(...c).d(...e) — the region it opened owns the rest.
            eq(['.', ['{}', [[':', 'g', constMethods]]], 'g', ['|?.()', noArgs,
                ['|.', 'id', ['|()', ['[]', [7]]]]]], 7)
        },
        // ... and the guard is the whole difference: on a nullish value the
        // region opens and immediately short-circuits, so the node is
        // `undefined` rather than a call on nothing — and neither the
        // arguments nor any later step runs.
        optionCallStepSkips: () => {
            eq(['.', ['{}', []], 'absent', ['|?.()', boom]], undefined)
            eq(['.', ['{}', [[':', 'b', null]]], 'b', ['|?.()', boom,
                ['|.', boomIndex, ['|()', boom]]]], undefined)
        },
        // The receiver is what a property step leaves behind, and it is
        // real rather than bookkeeping: `[42].at(0)` is `42` only because
        // `at` is called *on* the array. A `.` node with no continuation
        // operand computes the same function value and drops it
        // (`throw.detachedReceiver`) — the pair `chainsJs.receiver` makes in
        // JavaScript, made here by the nodes.
        receiver: () => {
            eq(['.', ['[]', [42]], 'at', ['|()', ['[]', [0]]]], 42)
            eq(['.', ['[]', [42]], 'at', ['|?.()', ['[]', [0]]]], 42)
            // A call step consumed the receiver of the step before it, so
            // `'ab'.at(0).toUpperCase()` needs a second `.` node to make its
            // own — which is exactly why `|()` is terminal here.
            eq(['.',
                ['.', 'ab', 'at', ['|()', ['[]', [0]]]],
                'toUpperCase',
                ['|()', noArgs]], 'A')
        },
        throw: {
            // `const at = a.at; at(0)` — the receiver a `.` node keeps for
            // the call it owns is exactly what the shorter arity drops,
            // and the host method is strict, so the detached call throws.
            detachedReceiver: () =>
                ev(['()', ['.', ['[]', [42]], 'at'], ['[]', [0]]]),
            // `((a.at)(0))(0)` — the same detachment reached through a call
            // node, so the callee is a bare value rather than an accessor.
            // A host method is what makes that observable: an `=>` closure
            // ignores whatever `this` it is handed, so only this spelling
            // catches a receiver *invented* for a bare value — which is
            // what a method-call spelling of `callValue` would do, returning
            // `Array.prototype.at` where JavaScript throws. See `callValue`
            // in `./module.f.mjs`.
            detachedReceiverAfterCall: () =>
                ev(['()',
                    ['()', ['.', ['[]', [42]], 'at'], ['[]', [0]]],
                    ['[]', [0]]]),
            // A step is only as good as what it lands on: a call step onto a
            // value that is not callable reaches the same host `TypeError`
            // as `throw.callNonFunction`, one node earlier.
            callStepOnNonFunction: () =>
                ev(['.', ['{}', [[':', 'a', 1]]], 'a', ['|()', noArgs]]),
            // A `.` node guards nothing, so a nullish base throws at the
            // access — the operand-evaluation half of the pair
            // `../proof.f.mjs`'s `chainsJs.throw` cannot state in JavaScript:
            // here the arguments are never reached, where
            // `optionRegion.throw.closeStepOnUndefined` evaluates them and
            // then calls `undefined`.
            propertyOnUndefined: () => ev(['.', undef, 'at', ['|()', noArgs]]),
            propertyOnNull: () => ev(['.', null, 'at', ['|()', noArgs]]),
        },
    },
    // `?.` — the node that opens an optional *region*: its own `?.[index]`
    // is the region's first step and the continuation is the rest, so a
    // nullish input makes the node `undefined` instead of running into a
    // call. Every case here has a counterpart under `chain` that throws for
    // exactly that reason.
    optionDot: () => {
        // a?.b — the node's own step, which is the whole node at the
        // shorter arity. Reading `a` and skipping the step would
        // evaluate to `a` itself, so these pin the index is applied.
        eq(['?.', ['{}', [[':', 'a', 7]]], 'a'], 7)
        // A closure is a value like any other — compared by `typeof`, since
        // every evaluation of a `=>` builds a fresh one (see `lambda`).
        assert(typeof ev(['?.', methods, 'id']) === 'function')
        same(['?.', ['[]', [1, 2, 3]], 1], 2)
        eq(['?.', ['[]', [1, 2, 3]], ['Number', '1']], 2)
        // An absent property is `undefined`, not an error: `?.` guards its
        // *input*, never its result.
        eq(['?.', ['{}', []], 'absent'], undefined)
        // ... and on a nullish input the node is `undefined`, both ways of
        // being nullish.
        eq(['?.', undef, 'a'], undefined)
        eq(['?.', null, 'a'], undefined)
        // a?.b.c — `|.` continues the region, handing the receiver on within
        // it, and the steps run when nothing short-circuited.
        eq(['?.', ['{}', [[':', 'o', ['{}', [[':', 'a', 7]]]]]], 'o',
            ['|.', 'a']], 7)
        // a?.b(...c) — `|()` inherits the region's guard and the receiver
        // survives into it, which is why `?.` owns its call rather than
        // evaluating to a value a `()` node would then have to call:
        // `[42]?.at(0)` is `42` only if `at` is called *on* the array.
        eq(['?.', ['[]', [42]], 'at', ['|()', ['[]', [0]]]], 42)
        // a?.b?.(...c) — `|?.()` adds its own guard on top of the region's.
        eq(['?.', ['[]', [42]], 'at', ['|?.()', ['[]', [0]]]], 42)
        // (a?.b)(...c) — `|!()` escapes the region, and keeps the receiver:
        // the parentheses end the chain, they do not detach the reference.
        eq(['?.', ['[]', [42]], 'at', ['|!()', ['[]', [0]]]], 42)
        // (a?.b.c)(...d) — the same close one property step further in.
        eq(['?.', methods, 'o', ['|.', 'id', ['|!()', ['[]', [7]]]]], 7)
        // a?.b.c?.(...d) — the guarded call reached through a property step,
        // which is the region handing `optionPropertyLambda` back to itself.
        eq(['?.', methods, 'o', ['|.', 'id', ['|?.()', ['[]', [7]]]]], 7)
        // a?.b(...c).d(...e) — one region across two calls, the second
        // making its own receiver.
        eq(['?.', ['{}', [[':', 'g', constMethods]]], 'g',
            ['|()', noArgs, ['|.', 'id', ['|()', ['[]', [7]]]]]], 7)
    },
    // `?.()` — the other region-opening node. Its callee is an ordinary
    // expression, so it never carries a receiver; what it owns is the rest
    // of the region, run on the call's result.
    optionCall: () => {
        // f?.(...c)
        eq(['?.()', identity, ['[]', [7]]], 7)
        // ... and the args operand is one node evaluating to the whole
        // argument array, as everywhere else a call takes one.
        same(['?.()', argsNode, ['[]', [5, 6]]], [5, 6])
        // f?.(...c)(...d) — `|()` stays inside the region.
        eq(['?.()', constIdentity, noArgs, ['|()', ['[]', [7]]]], 7)
        // f?.(...c).d(...e) — `|.` makes a receiver for the call after it,
        // which is the receiver chain `../README.md` gives as the reason
        // there is no `.()` node.
        eq(['?.()', constMethods, noArgs,
            ['|.', 'id', ['|()', ['[]', [7]]]]], 7)
    },
    // The short-circuit, which is what the two region-opening nodes exist
    // for: they return rather than throw, so — unlike a `.` node, where
    // every nullish case is a `throw` — the skip is directly observable,
    // operands included.
    optionRegion: {
        skips: () => {
            // u?.b.c is `undefined`, where `(u?.b).c` throws: one region
            // against two nodes (`../README.md`, "Chains"). `boomIndex` as
            // the skipped step's index would throw if the step ran.
            eq(['?.', undef, 'a', ['|.', boomIndex]], undefined)
            // u?.b(...c) is `undefined`, where `(u?.b)(...c)` throws — the
            // pair `throw.closeStepOnUndefined` completes. The skipped
            // call's arguments are not evaluated either.
            eq(['?.', undef, 'at', ['|()', boom]], undefined)
            // The node's own index is skipped too, which is the operand
            // `../proof.f.mjs`'s `chainsJs.shortCircuit` pins in JavaScript
            // as `u?.[todo()]`.
            eq(['?.', undef, boomIndex], undefined)
            eq(['?.', null, boomIndex, ['|.', boomIndex]], undefined)
            // A guarded step mid-region short-circuits the same way: here
            // `a.b` is `undefined`, so `|?.()` skips itself and everything
            // after it.
            eq(['?.', ['{}', [[':', 'b', undef]]], 'b',
                ['|?.()', boom, ['|.', boomIndex]]], undefined)
            // The nullish value need not be the node's own input: a property
            // step reading an absent property produces one mid-region, and
            // the guard after it skips the rest.
            eq(['?.', methods, 'absent', ['|?.()', boom]], undefined)
            // f?.(...c) with a nullish `f`: `undefined`, and the arguments
            // are not evaluated. Both ways of being nullish.
            eq(['?.()', undef, boom], undefined)
            eq(['?.()', null, boom], undefined)
            // ... and the continuation is skipped along with the call.
            eq(['?.()', undef, boom, ['|.', boomIndex, ['|()', boom]]],
                undefined)
        },
        throw: {
            // `(u?.b)(...c)` — the one step a short-circuit does *not* skip.
            // The parentheses ended the region, so the `undefined` it
            // produced is what gets called, and that is a throw on every
            // host. It cannot be pinned in JavaScript at all:
            // JavaScriptCore (so `bun test`) carries the short-circuit
            // through the parentheses and answers `undefined`, which is why
            // `../proof.f.mjs`'s `chainsJs.throw.groupedOptionalCall` is
            // commented out. The node denotes the throw regardless — see
            // "Chains" in `../README.md`.
            closeStepOnUndefined: () =>
                ev(['?.', undef, 'at', ['|!()', noArgs]]),
            closeStepOnNull: () =>
                ev(['?.', null, 'at', ['|!()', noArgs]]),
            // `(u?.b.c)(...d)` — the same, reached past a skipped `|.`: the
            // walk that drops steps has to keep looking for the close rather
            // than stop at the first one it skips.
            closeStepPastSkippedProperty: () =>
                ev(['?.', undef, 'at', ['|.', boomIndex, ['|!()', noArgs]]]),
            // `(u?.(...a).c)(...d)` — and it reaches one from the other
            // region-opening node too, through the `|.` that leaves
            // `optionLambda` for `optionPropertyLambda`.
            closeStepAfterOptionCall: () =>
                ev(['?.()', undef, boom, ['|.', boomIndex, ['|!()', noArgs]]]),
            // `(a.absent?.(...b).m)(...d)` — and from a `.` node, whose
            // `|?.()` opens a region that short-circuits at once. That is the
            // third and last entry to `skip`, so between them the three cases
            // cover every state a region can be abandoned in.
            closeStepAfterPropertyGuard: () =>
                ev(['.', methods, 'absent',
                    ['|?.()', boom, ['|.', boomIndex, ['|!()', noArgs]]]]),
            // `(a.absent?.(...b))(...d)` — the same short-circuit under a
            // *node* boundary instead of a step: the `.` node evaluates to
            // `undefined` and the `()` over it calls that. The step spelling
            // above and this one are the two halves of the parenthesis law
            // at the same place, and they agree.
            callOfSkippedGuard: () =>
                ev(['()', ['.', methods, 'absent', ['|?.()', boom]], noArgs]),
        },
    },
    // The frame is the only channel outward: a body's leaves are constants,
    // `['args']` and `['frame']`, so a captured value has to arrive as data.
    closure: () => {
        // `['=>', ['[]', [100]], …]` captures `100` at closure-creation time.
        eq(['()', ['=>', ['[]', [100]],
            ['+', ['.', ['args'], 0], ['.', ['frame'], 0]]],
            ['[]', [5]]], 105)
        // Nested: the outer call's argument is copied into the inner frame,
        // and the inner body reads it as `['frame']` — the same node
        // `['.', ['args'], 0]` could not have been shared across the `=>`.
        const outer = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]],
        ])
        eq(['()', ['()', outer, ['[]', [7]]], noArgs], 7)
        // The frame operand is evaluated in the enclosing scope, so it sees
        // that scope's `['args']` — the one place a `=>` node reaches out.
        assertEq(vm({ frame: null, args: [11] })(
            ['()', ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]],
                noArgs]),
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
        // mirror of `optionRegion.skips`'s skipped operands.
        evaluatedIndex: () => ev(['?.', ['{}', []], boomIndex]),
        // ... and so are an optional call's arguments once its callee turns
        // out to be there.
        evaluatedArgument: () => ev(['?.()', identity, boom]),
        // `?.()` guards against a *nullish* callee, not against a
        // non-callable one: `1?.()` is the host `TypeError`, exactly as
        // `throw.callNonFunction` is for `()`.
        optionCallOnNonFunction: () =>
            ev(['?.()', ['.', ['{}', [[':', 'a', 1]]], 'a'], noArgs]),
        // An array spread iterates its operand, so a non-iterable one throws
        // where the object form would have contributed nothing.
        arraySpreadOfNumber: () => ev(['[]', [['...', 1]]]),
        arraySpreadOfNull: () => ev(['[]', [['...', null]]]),
        // `own`'s key operand must evaluate to a string, and `ToPropertyKey`
        // coercion is exactly what that rules out.
        ownNonStringKey: () => ev(['own', ['{}', [[':', '1', 42]]], 1]),
        // The receiver is checked before the key: real `ToObject` runs
        // before `ToPropertyKey`, so a nullish receiver throws regardless
        // of the key.
        ownNullReceiver: () => ev(['own', null, 'a']),
        // Not a function: `()` calls whatever the callee operand evaluates
        // to, so this is the host `TypeError`, not a check of its own.
        callNonFunction: () => ev(['()', 1, noArgs]),
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
