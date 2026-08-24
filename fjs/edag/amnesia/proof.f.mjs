/**
 * Execution semantics of `vm` — one section per operand shape, since that is
 * how `map`'s handlers are built (`o1`/`o2`/`o2lazy`), plus the nodes that
 * evaluate their operands themselves (`,`, `[]`, `{}`, and `()` with its
 * chain) and the two that are still `todo`, `?.` and `?.()`. This is the
 * executing counterpart of `../proof.f.mjs`, which pins what the schema
 * *accepts*; nothing here validates.
 *
 * @import { Exp } from '../types.ts'
 * @import { Context } from './types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Array as ExpArray, Call, Op1, Op2 } from '../types.ts'
 * @import { Get } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm } from './module.f.mjs'

// `TagMap` exists so a dispatcher generic over `K` sees one handler
// signature; these pin the tag -> node-tuple correlation it is built on,
// including the two tags whose node kinds are not `op1`/`op2`.
/** @typedef {Assert<Equal<Get<'+'>, Op2>>} _PlusIsOp2 */
/** @typedef {Assert<Equal<Get<'neg'>, Op1>>} _NegIsOp1 */
/** @typedef {Assert<Equal<Get<'[]'>, ExpArray>>} _BracketsIsArray */
/** @typedef {Assert<Equal<Get<'()'>, Call>>} _CallIsCall */

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
    // A call rebuilds the callee's scope from two places: `frame` comes from
    // the closure, `args` from the call site.
    call: () => {
        eq(['()', identity, [], ['[]', [7]]], 7)
        // The args operand is one node evaluating to the complete argument
        // array, so `['args']` in the callee *is* that array — not the array
        // wrapped in another one, and not just its first element.
        same(['()', argsNode, [], ['[]', [5, 6]]], [5, 6])
        same(['()', argsNode, [], ['[]', []]], [])
        // ... and any node evaluating to an array serves, which is what
        // makes `f(...xs)` need no `...` node: the whole array passes through.
        same(['()', argsNode, [], ['[]', [1, ['...', ['[]', [2, 3]]]]]], [1, 2, 3])
        // Operands are evaluated in the *caller's* scope, before the callee's
        // exists: the callee expression as much as the arguments.
        eq(['()', ['.', ['[]', [identity]], 0], [], ['[]', [['+', 3, 4]]]], 7)
    },
    // The other side of that `lambdas` guard: a non-empty one, the chain
    // that reaches the callee. A step is a function of the current chain
    // value with its argument elided — `../README.md`, "Chains" — so it can
    // be neither an `exp` nor shared, and the receiver and the short-circuit
    // exist only while the chain is being walked. One case group per step
    // id; all four end in the node's own final call.
    chain: {
        // `['|.', index]` — a property step. The value called is the
        // property, and the object it came from stays behind as the
        // receiver (`receiver`, below).
        propertyStep: () => {
            // a.b(...c)
            eq(['()', methods, [['|.', 'id']], ['[]', [7]]], 7)
            // (a.b.c)(...d) — steps compose, each reading the last value,
            // and a non-optional chain means the same parenthesized or not.
            eq(['()', methods, [['|.', 'o'], ['|.', 'id']], ['[]', [7]]], 7)
            // The args operand is still one node evaluating to the whole
            // argument array: a chain changes what is called, not how it is
            // called.
            same(['()', methods, [['|.', 'args']], ['[]', [5, 6]]], [5, 6])
            same(['()', methods, [['|.', 'args']], ['[]', []]], [])
            // An `index` is a string, a number, or `['Number', exp]` — the
            // three forms `.` takes, evaluated the same way.
            eq(['()', ['[]', [identity]], [['|.', 0]], ['[]', [7]]], 7)
            eq(['()', ['[]', [identity]], [['|.', ['Number', '0']]], ['[]', [7]]], 7)
        },
        // `['|()', exp]` — a call step: call the current value with the
        // current receiver, then *clear* it. `o.f()(7)` is `7`; were the
        // receiver kept instead, the final call would be `o.f(7)` and this
        // would evaluate to the inner closure rather than to `7`.
        callStep: () => {
            // f(...a)(...b), with no receiver at either end.
            eq(['()', constIdentity, [['|()', ['[]', []]]], ['[]', [7]]], 7)
            eq(['()', methods, [['|.', 'f'], ['|()', ['[]', []]]], ['[]', [7]]], 7)
        },
        // `['|?.', index]` and `['|?.()', exp]` — the optional pair, which
        // differs from the plain one only on a nullish input. Every case
        // here has a non-nullish one, so each behaves as its counterpart;
        // the other branch is under `throw`, where it belongs, since `()`
        // is the *grouped* spelling and calls what the chain produced.
        optionalStep: () => {
            // (a?.b)(...c) and (a?.(...b))(...c)
            eq(['()', methods, [['|?.', 'id']], ['[]', [7]]], 7)
            eq(['()', constIdentity, [['|?.()', ['[]', []]]], ['[]', [7]]], 7)
            // (a.b?.(...c))(...d) — an optional call step consuming the
            // receiver the property step before it left.
            eq(['()', methods, [['|.', 'f'], ['|?.()', ['[]', []]]], ['[]', [7]]], 7)
            // (a?.(...b)?.c)(...d) — the receiver chain `../README.md` gives
            // as the reason there is no `.()` node: a call step, then a
            // property step making a receiver for the final call.
            eq(['()', constMethods,
                [['|?.()', ['[]', []]], ['|?.', 'id']], ['[]', [7]]], 7)
        },
        // The receiver is what a property step leaves behind, and it is
        // real rather than bookkeeping: `[42].at(0)` is `42` only because
        // `at` is called *on* the array. A `.` node computes the same
        // function value and drops it (`throw.detachedReceiver`) — the pair
        // `chainsJs.receiver` makes in JavaScript, made here by the nodes.
        // `|?.` keeps it too, which is why `(a?.b)(d)` is one `()` with a
        // `|?.` step rather than a completed `['?.', …]` node handing on an
        // ordinary value.
        receiver: () => {
            eq(['()', ['[]', [42]], [['|.', 'at']], ['[]', [0]]], 42)
            eq(['()', ['[]', [42]], [['|?.', 'at']], ['[]', [0]]], 42)
            // A call step consumed the receiver of the step before it, so
            // `'ab'.at(0).toUpperCase()` needs the second one to make its
            // own — the chain carries at most the last property step's.
            eq(['()', 'ab',
                [['|.', 'at'], ['|()', ['[]', [0]]], ['|.', 'toUpperCase']],
                ['[]', []]], 'A')
        },
        throw: {
            // A nullish input short-circuits the chain, and under `()` that
            // is always an error: this node is the *grouped* spelling
            // `(u?.b)(d)`, whose parentheses end the optional region, so
            // `undefined` is what ends up being called. That is the
            // specification's reading — see "Chains" in `../README.md`,
            // where it is also why `chainsJs` cannot pin this in JavaScript:
            // JavaScriptCore carries the short-circuit through the
            // parentheses. The node denotes the throw on every host, so
            // unlike the JavaScript, these cases can be stated at all.
            optionalPropertyOnUndefined: () =>
                ev(['()', ['undefined'], [['|?.', 'at']], ['[]', [0]]]),
            optionalPropertyOnNull: () =>
                ev(['()', null, [['|?.', 'at']], ['[]', [0]]]),
            optionalCallOnUndefined: () =>
                ev(['()', ['undefined'], [['|?.()', ['[]', []]]], ['[]', []]]),
            optionalCallOnNull: () =>
                ev(['()', null, [['|?.()', ['[]', []]]], ['[]', []]]),
            // The nullish value need not be the chain's input: a property
            // step reading an absent property produces one mid-chain.
            optionalCallOnAbsentProperty: () =>
                ev(['()', methods,
                    [['|.', 'absent'], ['|?.()', ['[]', []]]], ['[]', []]]),
            // Once a step has short-circuited, every step after it is
            // skipped, operands and all: `['Number', boom]` would throw if
            // the skipped `|.` evaluated its index. Both readings throw
            // here, so this pins that the path exists, not which error came
            // out of it — `fjs/AGENTS.md` §1.5 on not over-investing in a
            // throw's payload.
            skipsTheRestOfTheChain: () =>
                ev(['()', ['undefined'],
                    [['|?.', 'at'], ['|.', ['Number', boom]]], ['[]', []]]),
            // `const at = a.at; at(0)` — the receiver a `|.` step keeps is
            // exactly what reading the same property as a `.` node drops,
            // and the host method is strict, so the detached call throws.
            detachedReceiver: () =>
                ev(['()', ['.', ['[]', [42]], 'at'], [], ['[]', [0]]]),
            // A step is only as good as what it lands on: a property step
            // onto a value that is not callable reaches the same host
            // `TypeError` as `throw.callNonFunction`, one node earlier.
            propertyStepOnNonFunction: () =>
                ev(['()', ['{}', [[':', 'a', 1]]], [['|.', 'a']], ['[]', []]]),
        },
    },
    // The frame is the only channel outward: a body's leaves are constants,
    // `['args']` and `['frame']`, so a captured value has to arrive as data.
    closure: () => {
        // `['=>', ['[]', [100]], …]` captures `100` at closure-creation time.
        eq(['()', ['=>', ['[]', [100]], ['+', ['.', ['args'], 0], ['.', ['frame'], 0]]],
            [], ['[]', [5]]], 105)
        // Nested: the outer call's argument is copied into the inner frame,
        // and the inner body reads it as `['frame']` — the same node
        // `['.', ['args'], 0]` could not have been shared across the `=>`.
        const outer = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]],
        ])
        eq(['()', ['()', outer, [], ['[]', [7]]], [], ['[]', []]], 7)
        // The frame operand is evaluated in the enclosing scope, so it sees
        // that scope's `['args']` — the one place a `=>` node reaches out.
        assertEq(vm({ frame: null, args: [11] })(
            ['()', ['=>', ['[]', [['.', ['args'], 0]]], ['.', ['frame'], 0]], [], ['[]', []]]),
            11)
    },
    // Closures are ordinary values: passable as arguments, returnable, and
    // callable from a node that computed them rather than named them.
    higherOrder: () => {
        // `(g, x) => g(x)`
        const apply = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['()', ['.', ['args'], 0], [], ['[]', [['.', ['args'], 1]]]],
        ])
        eq(['()', apply, [], ['[]', [identity, 7]]], 7)
        // `x => y => x + y`, applied twice — the classic case the frame
        // exists for.
        const add = /** @type {Exp} */ ([
            '=>', ['[]', []],
            ['=>', ['[]', [['.', ['args'], 0]]],
                ['+', ['.', ['frame'], 0], ['.', ['args'], 0]]],
        ])
        eq(['()', ['()', add, [], ['[]', [2]]], [], ['[]', [3]]], 5)
    },
    throw: {
        // Still `todo`: the two optional chain nodes. `()` walks a
        // `lambdas` now (`chain`), but these two own a whole optional
        // region — a nullish input skips the rest of the *node*, rather
        // than running into a call of `undefined` as the grouped spelling
        // does — so they need more than the step walk.
        optionalPropertyAccessor: () => ev(['?.', ['undefined'], 'a', []]),
        optionalCall: () => ev(['?.()', ['undefined'], [], ['undefined'], []]),
        // An array spread iterates its operand, so a non-iterable one throws
        // where the object form would have contributed nothing.
        arraySpreadOfNumber: () => ev(['[]', [['...', 1]]]),
        arraySpreadOfNull: () => ev(['[]', [['...', null]]]),
        // `own`'s key operand must evaluate to a string, and `ToPropertyKey`
        // coercion is exactly what that rules out.
        ownNonStringKey: () => ev(['own', ['{}', [[':', '1', 42]]], 1]),
        // Not a function: `()` calls whatever the callee operand evaluates
        // to, so this is the host `TypeError`, not a check of its own.
        callNonFunction: () => ev(['()', 1, [], ['[]', []]]),
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
