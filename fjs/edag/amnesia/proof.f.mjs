/**
 * Represented execution, ordered failures and optional chains. Amnesia
 * recomputes shared code while retaining the identity of captured, passed and
 * explicitly established values. Nothing here validates the input graph.
 *
 * @import { Args, Exp, Index } from '../types.ts'
 * @import { Context } from './types.ts'
 * @import { EdagValue, Values, Array as ValueArray } from '../value/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm, invoke } from './module.f.mjs'
import { toUnknown } from '../value/to_unknown/module.f.mjs'
import { call } from '../value/call/module.f.mjs'
import { typeOf } from '../value/semantics/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'

/** The one value in `context`'s frame, slot `0`. */
const captured = /** @type {const} */ (['{}', [[':', 'x', 1]]])

/** @type {Context} */
const context = { frame: [captured], args: [10, 20] }

/** @type {(e: Exp) => EdagValue} */
const value = e => assertOk(vm(context)(e))

/** Decode only data; functions and identity checks stay represented. @type {(e: Exp) => unknown} */
const ev = e => assertOk(toUnknown(value(e)))

/** @type {(e: Exp, expected?: EdagValue) => void} */
const fails = (e, expected = ['undefined']) => assertStructurallySame(assertError(vm(context)(e)), expected)

/** @type {(fn: EdagValue, args?: Values) => EdagValue} */
const apply = (fn, args = []) => assertOk(call(ok(fn), args.map(a => () => ok(a)), invoke))

/** @type {(v: EdagValue) => Values} */
const elements = v => /** @type {ValueArray} */ (v)[1]

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

/** The empty argument list, for a call whose arguments are beside the point. @type {Args} */
const noArgs = []

/**
 * `a => a` with an empty frame — the smallest callable, used wherever a
 * case is about the call and not about what the callee computes.
 * @type {Exp}
 */
const identity = ['=>', 0, [], ['.', ['rest'], 0]]

/** `(...a) => a` — hands back the whole argument array. @type {Exp} */
const argsNode = ['=>', 0, [], ['rest']]

/**
 * `() => (a => a)` — one call away from `identity`, so a chain can spend a
 * call step and still have something to call.
 * @type {Exp}
 */
const constIdentity = ['=>', 0, [], ['=>', 0, [], ['.', ['rest'], 0]]]

/**
 * `{ id: a => a, args: (...a) => a, f: () => (a => a), o: { id: a => a } }`
 * — a receiver for the property steps, holding a callee at depth one and at
 * depth two. Its methods are `=>` closures, so none of them can observe the
 * receiver a step retains; `chain.receiver` uses an admitted built-in for that.
 * @type {Exp}
 */
const methods = ['{}', [
    [':', 'id', identity],
    [':', 'args', argsNode],
    [':', 'f', constIdentity],
    [':', 'o', ['{}', [[':', 'id', identity]]]],
]]

/** `() => methods` — a chain starting with a call step needs one. @type {Exp} */
const constMethods = ['=>', 0, [], methods]

export const proof = {
    // A primitive is its own represented value, wrapped in success.
    primitive: () => {
        eq(1, 1)
        eq('a', 'a')
        eq(null, null)
        eq(true, true)
        eq(false, false)
        eq(1n, 1n)
    },
    // `op0` — the handlers that read `context` instead of operands, and
    // the frame slot read, which reads it by its index.
    // `undefined` is a node, not the bare value (see `Primitive`).
    op0: () => {
        eq(undef, undefined)
        assertEq(value(['frame', 0]), captured)
        same(['args'], context.args)
        // ... and `context` is threaded, not defaulted: another one is seen.
        /** @type {Context} */
        const other = { frame: ['f'], args: [] }
        assertEq(assertOk(vm(other)(['frame', 0])), 'f')
        assertStructurallySame(assertOk(vm(other)(['args'])), ['[]', []])
    },
    // `o1` — one evaluated operand.
    op1: () => {
        eq(['!', 0], true)
        eq(['!', 1], false)
        eq(['~', 0], -1)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
        // `typeof` — one tag per kind a value can have here; `null` is
        // `'object'` as in JS, and a represented closure is a function.
        eq(['typeof', undef], 'undefined')
        eq(['typeof', null], 'object')
        eq(['typeof', true], 'boolean')
        eq(['typeof', 1], 'number')
        eq(['typeof', 1n], 'bigint')
        eq(['typeof', 'a'], 'string')
        eq(['typeof', ['[]', []]], 'object')
        eq(['typeof', identity], 'function')
        // `throw` in a lazy position is not established, as nothing there
        // is; where it is, it fails — `failures.thrown` below.
        eq(['?:', true, 1, ['throw', 2]], 1)
        eq(['&&', false, ['throw', 2]], false)
    },
    // `o12` — the node's length picks the operation. The unary arms coerce
    // with `ToNumber`, so a string operand pins that they are not the binary
    // ones over a missing operand: `+'5'` is `5`, not `'5undefined'`.
    op12: {
        ok: () => {
            eq(['-', 5], -5)
            eq(['-', '5'], -5)
            eq(['-', 1n], -1n)
            eq(['+', 5], 5)
            eq(['+', '5'], 5)
            eq(['+', true], 1)
            eq(['-', 2, 3], -1)
            eq(['+', 2, 3], 5)
            eq(['+', 'a', 'b'], 'ab')
            eq(['-', ['-', 5]], 5)
        },
        // The one input on which unary `+` and `Number` part: `+0n` throws
        // where `Number(0n)` is `0`, which is why they are two operations and
        // not two spellings of one.
        failures: {
            bigintPlus: () => fails(['+', 0n]),
        },
    },
    // `o2` — both operands evaluated. Each case asserts a *value*, which is
    // what pins the whole group against `o2` wrapping another `(c, e) =>`
    // around `o2lazy`: that returns the handler uncalled, so every binary
    // operator would evaluate to a function rather than to a result.
    op2: () => {
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['!==', 2, 3], true)
        // `is` beside `===`, on the four inputs where the two part or meet:
        // `NaN` with itself, `0` with `-0`, an object with itself, and two
        // equal objects.
        eq(['is', NaN, NaN], true)
        eq(['===', NaN, NaN], false)
        eq(['is', 0, -0], false)
        eq(['===', 0, -0], true)
        eq(['is', 2, 2], true)
        /** @type {Exp} */
        const o = ['{}', []]
        /** @type {readonly (readonly[Exp, EdagValue])[]} */
        const one = [[o, value(o)]]
        assertEq(assertOk(vm({ ...context, memo: one })(['is', o, o])), true)
        assertEq(assertOk(vm({ ...context, memo: one })(['===', o, o])), true)
        eq(['is', ['{}', []], ['{}', []]], false)
        eq(['===', ['{}', []], ['{}', []]], false)
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
    // Plain property reads expose own represented data. Built-in methods
    // are dispatched only when the chain supplies a receiver and call.
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
        // A stock method is not an own data property.
        eq(['own', ['{}', []], 'toString'], undefined)
        // A key that is a string only after JS coercion is not a string key:
        // `own`'s key operand must *evaluate* to one, so `1` is rejected
        // rather than silently reading `'1'` — see `failures.ownNonStringKey`.
        eq(['own', ['{}', [[':', '1', 42]]], '1'], 42)
        eq(['.', ['{}', []], 'toString'], undefined)
    },
    // `o2lazy` — the right operand is a thunk, so these three short-circuit
    // — and `?:`, which establishes its condition and then one arm. Each
    // case that claims "not evaluated" uses `boom`, which throws if it is;
    // `failures.forced` calls the same nodes with the other left operand.
    lazy: () => {
        eq(['&&', false, boom], false)
        eq(['&&', true, 7], 7)
        eq(['||', true, boom], true)
        eq(['||', false, 7], 7)
        eq(['??', 0, boom], 0)
        eq(['??', null, 7], 7)
        eq(['?:', true, 7, boom], 7)
        eq(['?:', false, boom, 7], 7)
        // `ToBoolean` on the condition, as `&&`/`||` coerce: `0` is the
        // alternate, an object the consequent.
        eq(['?:', 0, boom, 8], 8)
        eq(['?:', ['[]', []], 9, boom], 9)
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
    // `memo` — the nodes a caller established, consulted by identity. It is
    // what lets this evaluator answer an identity question it otherwise
    // cannot: with the node established, `['===', n, n]` is one value
    // compared with itself, and without it two.
    established: () => {
        /** @type {Exp} */
        const node = ['[]', [1, 2]]
        // Amnesia as such: one node reached twice is two arrays.
        eq(['===', node, node], false)
        // Established: one value, so the comparison is an identity.
        /** @type {readonly (readonly[Exp, EdagValue])[]} */
        const one = [[node, value(node)]]
        assertEq(assertOk(vm({ ...context, memo: one })(['===', node, node])), true)
        // ... and it is the caller's value that comes back, not a fresh one.
        const marker = /** @type {const} */ (['[]', ['marker']])
        /** @type {readonly (readonly[Exp, EdagValue])[]} */
        const markerMemo = [[node, marker]]
        assertEq(assertOk(vm({ ...context, memo: markerMemo })(node)), marker)
        // A node the memo does not hold is computed as always.
        assertStructurallySame(assertOk(vm({ ...context, memo: one })(['[]', [3]])), ['[]', [3]])
        // A call is a new invocation, so nothing established crosses into a
        // body: the node inside evaluates fresh and is not the caller's value.
        /** @type {Exp} */
        const body = ['=>', 0, [], node]
        const f = assertOk(vm({ ...context, memo: markerMemo })(body))
        assert(apply(f) !== marker, ['the memo crossed a call boundary'])
    },
    // Operands are evaluated through `vm(context)`, so a node composes with
    // every other node kind and sees the same context at any depth.
    nested: () => {
        eq(['+', ['+', 1, 2], 3], 6)
        eq(['.', ['args'], 1], 20)
        eq(['.', ['frame', 0], 'x'], 1)
        same(
            ['{}', [[':', 'a', ['[]', [['.', ['args'], 0], ['-', 1]]]]]],
            { a: [10, -1] },
        )
    },
    // A function retains its evaluated captures and unevaluated body.
    lambda: () => {
        const f = value(identity)
        assertEq(typeOf(f), 'function')
        assertEq(apply(f, [7]), 7)
        // Every evaluation builds a fresh closure, as `x => x` does in JS —
        // the `=>` node is shared, the values it produces are not.
        assert(value(identity) !== value(identity))
        // Direct conversion, coercion and arrays use the same code-only text.
        eq(['String', identity], '(...$a)=>$a[0]')
        eq(['+', identity, ''], '(...$a)=>$a[0]')
        eq(['String', ['[]', [identity]]], '(...$a)=>$a[0]')
        eq(['String', ['=>', 1, [7], ['+', ['arg', 0], ['frame', 0]]]], '($a_0)=>$a_0+$0')
    },
    body: () => {
        /** @type {Exp} */
        const shared = ['[]', []]
        const fn = value(['=>', 2, [['frame', 0]], ['[]', [
            shared, shared, ['arg', 0], ['arg', 1], ['rest'], ['rest'], ['frame', 0],
        ]]])
        const first = elements(apply(fn, [7]))
        const second = elements(apply(fn, [8, 9, captured]))
        // No automatic memoization, even within a called body.
        assert(first[0] !== first[1])
        assert(first[0] !== second[0])
        assertEq(first[2], 7)
        assertStructurallySame(first[3], ['undefined'])
        assertEq(second[2], 8)
        assertEq(second[3], 9)
        assertEq(first[4], first[5])
        assert(first[4] !== second[4])
        assertEq(elements(second[4])[0], captured)
        assertEq(first[6], captured)
        assertEq(second[6], captured)
        const outer = value(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]])
        const inner = apply(outer, [captured])
        assertEq(apply(inner), captured)
        assertEq(apply(inner), captured)
    },
    // `()` — the call with no receiver and no region. A call rebuilds the
    // callee's scope from two places: `frame` comes from the closure, `args`
    // from the call site.
    call: () => {
        eq(['()', identity, [7]], 7)
        // The args operand is the item list of the complete argument array,
        // so `['args']` in the callee *is* that array — not the array
        // wrapped in another one, and not just its first element.
        same(['()', argsNode, [5, 6]], [5, 6])
        same(['()', argsNode, noArgs], [])
        // A spread item adds what its operand iterates, as in `[]`:
        // `f(1, ...[2, 3])` is the array `[1, ...[2, 3]]`, and
        // `f(...'ab')` passes the two strings.
        same(['()', argsNode, [1, ['...', ['[]', [2, 3]]]]], [1, 2, 3])
        same(['()', argsNode, [['...', 'ab']]], ['a', 'b'])
        // The list is read by position, never by its first item: a first
        // argument that spells a tag is an argument, `f('.', 1)`.
        same(['()', argsNode, ['.', 1]], ['.', 1])
        same(['()', argsNode, ['[]', 1]], ['[]', 1])
        // Forwarding is a spread of the rest array, `(...r) => g(...r)`.
        same(['()', ['=>', 0, [argsNode], ['()', ['frame', 0], [['...', ['rest']]]]], [5, 6]], [5, 6])
        // Operands are evaluated in the *caller's* scope, before the callee's
        // exists: the callee expression as much as the arguments.
        eq(['()', ['.', ['[]', [identity]], 0], [['+', 3, 4]]], 7)
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
            eq(['.', methods, 'id', ['|()', [7]]], 7)
            // (a.b.c)(...d) — a plain property path nests, and a non-optional
            // chain means the same parenthesized or not.
            eq(['.', ['.', methods, 'o'], 'id', ['|()', [7]]], 7)
            // The args operand is still one node evaluating to the whole
            // argument array: a chain changes what is called, not how it is
            // called.
            same(['.', methods, 'args', ['|()', [5, 6]]], [5, 6])
            same(['.', methods, 'args', ['|()', noArgs]], [])
            // The three `index` forms, in the naming position of the node
            // that owns the call.
            eq(['.', ['[]', [identity]], 0, ['|()', [7]]], 7)
            eq(['.', ['[]', [identity]], ['Number', '0'], ['|()', [7]]], 7)
        },
        // `['|?.()', exp, k]` — the guarded call step: it spends the receiver
        // and *opens* a region, so unlike `|()` it carries a continuation.
        // With a non-nullish value it behaves exactly as `|()` does.
        optionCallStep: () => {
            // a.b?.(...c)
            eq(['.', methods, 'id', ['|?.()', [7]]], 7)
            // a.b?.(...c).d(...e) — the region it opened owns the rest.
            eq(['.', ['{}', [[':', 'g', constMethods]]], 'g', ['|?.()', noArgs,
                ['|.', 'id', ['|()', [7]]]]], 7)
        },
        // ... and the guard is the whole difference: on a nullish value the
        // region opens and immediately short-circuits, so the node is
        // `undefined` rather than a call on nothing — and neither the
        // arguments nor any later step runs.
        optionCallStepSkips: () => {
            eq(['.', ['{}', []], 'absent', ['|?.()', [boom]]], undefined)
            eq(['.', ['{}', [[':', 'b', null]]], 'b', ['|?.()', [boom],
                ['|.', boomIndex, ['|()', [boom]]]]], undefined)
        },
        // The receiver is what a property step leaves behind, and it is
        // real rather than bookkeeping: `[42].at(0)` is `42` only because
        // `at` is called on the array. A bare property read does not expose
        // that built-in as an ordinary value.
        receiver: () => {
            eq(['.', ['[]', [42]], 'at', ['|()', [0]]], 42)
            eq(['.', ['[]', [42]], 'at', ['|?.()', [0]]], 42)
            // A call step consumed the receiver of the step before it, so
            // `'ab'.at(0).repeat(2)` needs a second `.` node to make its
            // own — which is exactly why `|()` is terminal here.
            eq(['.',
                ['.', 'ab', 'at', ['|()', [0]]],
                'repeat',
                ['|()', [2]]], 'aa')
        },
        failures: {
            // Reading a built-in as data returns undefined; calling it fails.
            detachedReceiver: () =>
                fails(['()', ['.', ['[]', [42]], 'at'], [0]]),
            // An outer call preserves the inner call's failure.
            detachedReceiverAfterCall: () =>
                fails(['()',
                    ['()', ['.', ['[]', [42]], 'at'], [0]],
                    [0]]),
            // A present own value must still be callable.
            callStepOnNonFunction: () =>
                fails(['.', ['{}', [[':', 'a', 1]]], 'a', ['|()', noArgs]]),
            // A `.` node guards nothing, so a nullish base throws at the
            // access — the operand-evaluation half of the pair
            // `../proof.f.mjs`'s `chainsJs.throw` cannot state in JavaScript:
            // here the arguments are never reached, where
            // `optionRegion.failures.closeStepOnUndefined` evaluates them and
            // then calls `undefined`.
            propertyOnUndefined: () => fails(['.', undef, 'at', ['|()', noArgs]]),
            propertyOnNull: () => fails(['.', null, 'at', ['|()', noArgs]]),
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
        assertEq(typeOf(value(['?.', methods, 'id'])), 'function')
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
        eq(['?.', ['[]', [42]], 'at', ['|()', [0]]], 42)
        // a?.b?.(...c) — `|?.()` adds its own guard on top of the region's.
        eq(['?.', ['[]', [42]], 'at', ['|?.()', [0]]], 42)
        // (a?.b)(...c) — `|!()` escapes the region, and keeps the receiver:
        // the parentheses end the chain, they do not detach the reference.
        eq(['?.', ['[]', [42]], 'at', ['|!()', [0]]], 42)
        // (a?.b.c)(...d) — the same close one property step further in.
        eq(['?.', methods, 'o', ['|.', 'id', ['|!()', [7]]]], 7)
        // a?.b.c?.(...d) — the guarded call reached through a property step,
        // which is the region handing `optionPropertyLambda` back to itself.
        eq(['?.', methods, 'o', ['|.', 'id', ['|?.()', [7]]]], 7)
        // a?.b(...c).d(...e) — one region across two calls, the second
        // making its own receiver.
        eq(['?.', ['{}', [[':', 'g', constMethods]]], 'g',
            ['|()', noArgs, ['|.', 'id', ['|()', [7]]]]], 7)
    },
    // `?.()` — the other region-opening node. Its callee is an ordinary
    // expression, so it never carries a receiver; what it owns is the rest
    // of the region, run on the call's result.
    optionCall: () => {
        // f?.(...c)
        eq(['?.()', identity, [7]], 7)
        // ... and the args operand is one node evaluating to the whole
        // argument array, as everywhere else a call takes one.
        same(['?.()', argsNode, [5, 6]], [5, 6])
        // f?.(...c)(...d) — `|()` stays inside the region.
        eq(['?.()', constIdentity, noArgs, ['|()', [7]]], 7)
        // f?.(...c).d(...e) — `|.` makes a receiver for the call after it,
        // which is the receiver chain `../README.md` gives as the reason
        // there is no `.()` node.
        eq(['?.()', constMethods, noArgs,
            ['|.', 'id', ['|()', [7]]]], 7)
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
            // pair `failures.closeStepOnUndefined` completes. The skipped
            // call's arguments are not evaluated either.
            eq(['?.', undef, 'at', ['|()', [boom]]], undefined)
            // The node's own index is skipped too, which is the operand
            // `../proof.f.mjs`'s `chainsJs.shortCircuit` pins in JavaScript
            // as `u?.[todo()]`.
            eq(['?.', undef, boomIndex], undefined)
            eq(['?.', null, boomIndex, ['|.', boomIndex]], undefined)
            // A guarded step mid-region short-circuits the same way: here
            // `a.b` is `undefined`, so `|?.()` skips itself and everything
            // after it.
            eq(['?.', ['{}', [[':', 'b', undef]]], 'b',
                ['|?.()', [boom], ['|.', boomIndex]]], undefined)
            // The nullish value need not be the node's own input: a property
            // step reading an absent property produces one mid-region, and
            // the guard after it skips the rest.
            eq(['?.', methods, 'absent', ['|?.()', [boom]]], undefined)
            // f?.(...c) with a nullish `f`: `undefined`, and the arguments
            // are not evaluated. Both ways of being nullish.
            eq(['?.()', undef, [boom]], undefined)
            eq(['?.()', null, [boom]], undefined)
            // ... and the continuation is skipped along with the call.
            eq(['?.()', undef, [boom], ['|.', boomIndex, ['|()', [boom]]]],
                undefined)
        },
        failures: {
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
                fails(['?.', undef, 'at', ['|!()', noArgs]]),
            closeStepOnNull: () =>
                fails(['?.', null, 'at', ['|!()', noArgs]]),
            // `(u?.b.c)(...d)` — the same, reached past a skipped `|.`: the
            // walk that drops steps has to keep looking for the close rather
            // than stop at the first one it skips.
            closeStepPastSkippedProperty: () =>
                fails(['?.', undef, 'at', ['|.', boomIndex, ['|!()', noArgs]]]),
            // `(u?.(...a).c)(...d)` — and it reaches one from the other
            // region-opening node too, through the `|.` that leaves
            // `optionLambda` for `optionPropertyLambda`.
            closeStepAfterOptionCall: () =>
                fails(['?.()', undef, [boom], ['|.', boomIndex, ['|!()', noArgs]]]),
            // `(a.absent?.(...b).m)(...d)` — and from a `.` node, whose
            // `|?.()` opens a region that short-circuits at once. That is the
            // third and last entry to `skip`, so between them the three cases
            // cover every state a region can be abandoned in.
            closeStepAfterPropertyGuard: () =>
                fails(['.', methods, 'absent',
                    ['|?.()', [boom], ['|.', boomIndex, ['|!()', noArgs]]]]),
            // `(a.absent?.(...b))(...d)` — the same short-circuit under a
            // *node* boundary instead of a step: the `.` node evaluates to
            // `undefined` and the `()` over it calls that. The step spelling
            // above and this one are the two halves of the parenthesis law
            // at the same place, and they agree.
            callOfSkippedGuard: () =>
                fails(['()', ['.', methods, 'absent', ['|?.()', [boom]]], noArgs]),
        },
    },
    // The frame is the only channel outward: a body's leaves are constants,
    // `['arg', N]`, `['rest']` and `['frame', i]`, so a captured value has
    // to arrive as data.
    closure: () => {
        // `['=>', 0, [100], …]` captures `100` at closure-creation time.
        eq(['()', ['=>', 0, [100],
            ['+', ['.', ['rest'], 0], ['frame', 0]]],
            [5]], 105)
        // Nested: the outer call's argument is copied into the inner frame,
        // and the inner body reads it as `['frame', 0]` — the same node
        // `['.', ['args'], 0]` could not have been shared across the `=>`.
        const outer = /** @type {Exp} */ ([
            '=>', 0, [],
            ['=>', 0, [['.', ['rest'], 0]], ['frame', 0]],
        ])
        eq(['()', ['()', outer, [7]], noArgs], 7)
        // The slots are evaluated in the enclosing scope, so they see that
        // scope's `['args']` — the one place a `=>` node reaches out.
        assertEq(assertOk(vm({ frame: [], args: [11] })(
            ['()', ['=>', 0, [['.', ['args'], 0]], ['frame', 0]],
                noArgs])),
            11)
    },
    // Closures are ordinary values: passable as arguments, returnable, and
    // callable from a node that computed them rather than named them.
    higherOrder: () => {
        // `(g, x) => g(x)`
        const apply = /** @type {Exp} */ ([
            '=>', 0, [],
            ['()', ['.', ['rest'], 0], [['.', ['rest'], 1]]],
        ])
        eq(['()', apply, [identity, 7]], 7)
        // `x => y => x + y`, applied twice — the classic case the frame
        // exists for.
        const add = /** @type {Exp} */ ([
            '=>', 0, [],
            ['=>', 0, [['.', ['rest'], 0]],
                ['+', ['frame', 0], ['.', ['rest'], 0]]],
        ])
        eq(['()', ['()', add, [2]], [3]], 5)
    },
    failures: {
        // The language's own `throw`: the operand is established, then the
        // operation fails with it — an array here, so that the case shows
        // the operand was built before the throw.
        thrown: () => fails(['throw', ['[]', [1]]], ['[]', [1]]),
        // The index of a `?.` whose input is *not* nullish is evaluated, the
        // mirror of `optionRegion.skips`'s skipped operands.
        evaluatedIndex: () => fails(['?.', ['{}', []], boomIndex]),
        // ... and so are an optional call's arguments once its callee turns
        // out to be there.
        evaluatedArgument: () => fails(['?.()', identity, [boom]]),
        // `?.()` guards against a *nullish* callee, not against a
        // non-callable one: `1?.()` fails just as an ordinary call does.
        optionCallOnNonFunction: () =>
            fails(['?.()', ['.', ['{}', [[':', 'a', 1]]], 'a'], noArgs]),
        // An array spread iterates its operand, so a non-iterable one throws
        // where the object form would have contributed nothing.
        arraySpreadOfNumber: () => fails(['[]', [['...', 1]]]),
        arraySpreadOfNull: () => fails(['[]', [['...', null]]]),
        // `own`'s key operand must evaluate to a string, and `ToPropertyKey`
        // coercion is exactly what that rules out.
        ownNonStringKey: () => fails(['own', ['{}', [[':', '1', 42]]], 1]),
        // The receiver is checked before the key: real `ToObject` runs
        // before `ToPropertyKey`, so a nullish receiver throws regardless
        // of the key.
        ownNullReceiver: () => fails(['own', null, 'a']),
        // A non-function returns an implicit represented failure.
        callNonFunction: () => fails(['()', 1, noArgs]),
        // The other side of `lazy`: with the left operand that does not
        // short-circuit, the thunk *is* forced and `boom` throws. Without
        // these, `o2lazy` returning `a` unconditionally would still pass.
        forcedAnd: () => fails(['&&', true, boom]),
        forcedOr: () => fails(['||', false, boom]),
        forcedCoalesce: () => fails(['??', null, boom]),
        forcedConsequent: () => fails(['?:', true, boom, 7]),
        forcedAlternate: () => fails(['?:', false, 7, boom]),
        // ... and `o2` forces it with no short-circuit to begin with.
        forcedEager: () => fails(['+', 1, boom]),
        payloads: () => {
            assertEq(assertError(vm(context)(['throw', ['frame', 0]])), captured)
            fails(['throw', ['throw', 40]], 40)
            fails(['()', ['=>', 1, [], ['throw', ['arg', 0]]], [41]], 41)
            fails(['()', 0, [['throw', 42]]], 42)
            fails(['own', null, ['throw', 43]], 43)
            fails([',', [['throw', 44], 0]], 44)
        },
    },
}
