/**
 * What `precompute` answers: the closure it builds, and what calling it
 * answers beside the closure it was given — the same content, and the
 * identities that differ named.
 *
 * @import { Exp } from '../types.ts'
 * @import { Closure, EdagValue, Values } from '../value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame as same } from '../../asserts/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { invoke } from '../memo/module.f.js'
import { call } from '../value/call/module.f.js'
import { structEq } from '../value/semantics/module.f.js'
import { precompute } from './module.f.js'

const run = precompute(undefined, 1_000)

/** @type {(v: EdagValue, args?: Values) => EdagValue} */
const apply = (v, args = []) => assertOk(call(ok(v), args.map(a => () => ok(a)), invoke))

/** The precomputed closure. @type {(fn: Closure) => Closure} */
const closure = fn => {
    const result = run(fn)
    assert(result instanceof Array && result[0] === '=>')
    return /** @type {Closure} */ (result)
}

/** Both closures answer the same content for `args`. @type {(a: Closure, b: Closure, args?: Values) => void} */
const agree = (a, b, args) => { assert(structEq(apply(a, args), apply(b, args))) }

/** `() => [1, 2]` @type {Closure} */
const pair = ['=>', 0, [], ['[]', [1, 2]]]

export const proof = {
    primitive: () => {
        // `() => 2 + 2` is `() => 4`
        same(closure(['=>', 0, [], ['+', 2, 2]]), ['=>', 0, [], 4])
    },
    primitiveOverCapture: () => {
        // `() => two + 2` with `two` captured is `() => 4`, capturing nothing
        same(closure(['=>', 0, [2], ['+', ['frame', 0], 2]]), ['=>', 0, [], 4])
    },
    primitiveBody: () => {
        /** @type {Closure} */
        const fn = ['=>', 0, [], 4]
        assert(run(fn) === fn)
    },
    endless: () => {
        // `() => forever()` over `const forever = () => forever()`: the call
        // ends with the count and is left where it is
        /** @type {Closure} */
        const forever = ['=>', 0, [], ['()', ['self'], []]]
        /** @type {Closure} */
        const fn = ['=>', 0, [forever], ['()', ['frame', 0], []]]
        assert(run(fn) === fn)
    },
    nullResult: () => {
        // `() => [null][0]` is `() => null`, and `x => [x, [null][0]]` is `x => [x, null]`
        /** @type {Exp} */
        const first = ['.', ['[]', [null]], 0]
        same(closure(['=>', 0, [], first]), ['=>', 0, [], null])
        same(closure(['=>', 1, [], ['[]', [['arg', 0], ['.', ['[]', [null]], 0]]]]), ['=>', 1, [], ['[]', [['arg', 0], null]]])
    },
    undefinedResult: () => {
        // `() => [].x` is `() => undefined`
        same(closure(['=>', 0, [], ['.', ['[]', []], 'x']]), ['=>', 0, [], ['undefined']])
    },
    container: () => {
        const result = closure(pair)
        same(result, ['=>', 0, [['[]', [1, 2]]], ['frame', 0]])
        agree(pair, result)
        // one array where two calls answered two
        assert(apply(pair) !== apply(pair))
        assert(apply(result) === apply(result))
    },
    open: () => {
        // `(a, ...r) => [a, r, self]` computes nothing ahead of a call
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [['arg', 0], ['rest'], ['self']]]]
        assert(run(fn) === fn)
    },
    leaves: () => {
        // a read of a slot and a node with no operand are left where they are
        /** @type {Closure} */
        const fn = ['=>', 1, [7], ['[]', [['arg', 0], ['frame', 0], ['undefined']]]]
        assert(run(fn) === fn)
    },
    closedPart: () => {
        // `x => [x, [1, 2], 2 + 2]`
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [['arg', 0], ['[]', [1, 2]], ['+', 2, 2]]]]
        const result = closure(fn)
        same(result, ['=>', 1, [['[]', [1, 2]]], ['[]', [['arg', 0], ['frame', 0], 4]]])
        agree(fn, result, [5])
    },
    failure: () => {
        // `x => x ? null.x : [1]`: the read fails at a call and not before
        /** @type {Exp} */
        const boom = ['.', null, 'x']
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['?:', ['arg', 0], boom, ['[]', [1]]]]
        const result = closure(fn)
        same(result, ['=>', 1, [['[]', [1]]], ['?:', ['arg', 0], boom, ['frame', 0]]])
        assert(result[3] instanceof Array && result[3][2] === boom)
        agree(fn, result, [false])
        assertError(call(ok(result), [() => ok(true)], invoke))
    },
    frame: () => {
        // `make` captured: `() => make(1)` calls it once, here
        /** @type {Closure} */
        const make = ['=>', 1, [], ['[]', [['arg', 0]]]]
        /** @type {Closure} */
        const fn = ['=>', 0, [make], ['()', ['frame', 0], [1]]]
        const result = closure(fn)
        // and `make`, read no more, is no longer captured
        same(result, ['=>', 0, [['[]', [1]]], ['frame', 0]])
        agree(fn, result)
    },
    comma: () => {
        // `x => ([1], x)` is `x => x`: an operand evaluated ahead is done
        same(closure(['=>', 1, [], [',', [['[]', [1]], ['arg', 0]]]]), ['=>', 1, [], ['arg', 0]])
        // `f => ([1], f(), 5)` keeps the call
        same(
            closure(['=>', 1, [], [',', [['[]', [1]], ['()', ['arg', 0], []], 5]]]),
            ['=>', 1, [], [',', [['()', ['arg', 0], []], 5]]])
    },
    renumbered: () => {
        // `x => [x, make(1), seven]`: the captures left are read by their new slots
        /** @type {Closure} */
        const make = ['=>', 1, [], ['[]', [['arg', 0]]]]
        /** @type {Closure} */
        const fn = ['=>', 1, [make, 7], ['[]', [['arg', 0], ['()', ['frame', 0], [1]], ['frame', 1]]]]
        const result = closure(fn)
        same(result, ['=>', 1, [7, ['[]', [1]]], ['[]', [['arg', 0], ['frame', 1], ['frame', 0]]]])
        agree(fn, result, [5])
    },
    sharedNode: () => {
        // `x => { const c = []; return [x, c, [c]] }`: `c` stays one array
        /** @type {Exp} */
        const c = ['[]', []]
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [['arg', 0], c, ['[]', [c]]]]]
        const result = closure(fn)
        same(result[3], ['[]', [['arg', 0], ['frame', 0], ['frame', 1]]])
        const [, [, first, [, [second]]]] = /** @type {readonly [string, readonly [unknown, unknown, readonly [string, readonly unknown[]]]]} */ (apply(result, [0]))
        assert(first === second)
        agree(fn, result, [0])
    },
    nested: () => {
        // `x => [y => [x, y, [1]], () => 2 + 2]`: the open function's `[1]`
        // is made once and handed to it through a slot, and the closed
        // function is made once
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [
            ['=>', 1, [['arg', 0]], ['[]', [['frame', 0], ['arg', 0], ['[]', [1]]]]],
            ['=>', 0, [], ['+', 2, 2]],
        ]]]
        const result = closure(fn)
        same(result, ['=>', 1, [['[]', [1]], ['=>', 0, [], ['+', 2, 2]]], ['[]', [
            ['=>', 1, [['arg', 0], ['frame', 0]], ['[]', [['frame', 0], ['arg', 0], ['frame', 1]]]],
            ['frame', 1],
        ]]])
        const [, [inner]] = /** @type {readonly [string, readonly Closure[]]} */ (apply(result, [3]))
        same(apply(inner, [4]), ['[]', [3, 4, ['[]', [1]]]])
        // one array for every call of every inner function
        const [, [again]] = /** @type {readonly [string, readonly Closure[]]} */ (apply(result, [5]))
        const [, [, , first]] = /** @type {readonly [string, readonly unknown[]]} */ (apply(inner, [4]))
        const [, [, , second]] = /** @type {readonly [string, readonly unknown[]]} */ (apply(again, [6]))
        assert(first === second)
    },
    nestedKnownSlot: () => {
        // `x => y => [x, make(1), five]`, `make` captured: the inner slots
        // holding `make` and `5` are known, so the call is made here, and
        // `make` is captured by neither function afterwards
        /** @type {Closure} */
        const make = ['=>', 1, [], ['[]', [['arg', 0]]]]
        /** @type {Closure} */
        const fn = ['=>', 1, [make], ['=>', 1, [['arg', 0], ['frame', 0], 5],
            ['[]', [['frame', 0], ['()', ['frame', 1], [1]], ['frame', 2]]]]]
        const result = closure(fn)
        same(result, ['=>', 1, [['[]', [1]]], ['=>', 1, [['arg', 0], 5, ['frame', 0]],
            ['[]', [['frame', 0], ['frame', 2], ['frame', 1]]]]])
        same(apply(apply(result, [7]), [8]), apply(apply(fn, [7]), [8]))
    },
    nestedUnknownSlot: () => {
        // a closed slot that fails is unknown, and fails at the call as before
        /** @type {Exp} */
        const inner = ['[]', [['frame', 0], ['frame', 1], ['[]', [1]]]]
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['=>', 0, [['arg', 0], ['.', null, 'x']], inner]]
        const result = closure(fn)
        same(result, ['=>', 1, [['[]', [1]]], ['=>', 0, [['arg', 0], ['.', null, 'x'], ['frame', 0]],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2]]]]])
        assertError(call(ok(result), [() => ok(1)], invoke))
    },
    nestedUntouched: () => {
        // `x => [y => [x, y], y => 5, [1]]`: nothing to evaluate in either inner function
        /** @type {Exp} */
        const pairOf = ['=>', 1, [['arg', 0]], ['[]', [['frame', 0], ['arg', 0]]]]
        /** @type {Exp} */
        const five = ['=>', 1, [['arg', 0]], 5]
        const result = closure(['=>', 1, [], ['[]', [pairOf, five, ['[]', [1]]]]])
        same(result, ['=>', 1, [['[]', [1]]], ['[]', [pairOf, five, ['frame', 0]]]])
        const [, [first, second]] = /** @type {readonly [string, readonly unknown[]]} */ (result[3])
        assert(first === pairOf)
        assert(second === five)
    },
    group: () => {
        // `() => { const even = …; const odd = …; return [even(2), x] }`:
        // a closed call into a function group is made, and the group goes
        // with the node it was read by
        /** @type {Exp} */
        const members = ['group', [], [
            [1, ['?:', ['===', ['arg', 0], 0], true, ['()', ['self', 1], [['-', ['arg', 0], 1]]]]],
            [1, ['?:', ['===', ['arg', 0], 0], false, ['()', ['self', 0], [['-', ['arg', 0], 1]]]]],
        ]]
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [['()', ['fn', members, 0], [2]], ['arg', 0]]]]
        const result = closure(fn)
        same(result, ['=>', 1, [], ['[]', [true, ['arg', 0]]]])
        agree(fn, result, [7])
    },
    groupFunction: () => {
        // a function of a group is answered as itself: nothing is
        // precomputed in a member's body yet
        /** @type {EdagValue} */
        const member = ['fn', ['group', [], [[0, ['+', 2, 2]]]], 0]
        assertEq(run(member), member)
    },
    existing: () => {
        // what exists is never made again: a container nothing changed in
        // is itself, and beside a function that changed its neighbours are
        /** @type {EdagValue} */
        const data = ['[]', [1, ['{}', [[':', 'a', ['[]', []]]]]]]
        assert(run(data) === data)
        /** @type {EdagValue} */
        const mixed = ['{}', [[':', 'data', data], [':', 'pair', pair]]]
        const [, [kept, [, , changed]]] = /** @type {readonly [string, readonly [unknown, readonly [string, string, Closure]]]} */ (run(mixed))
        assert(kept === mixed[1][0])
        same(changed, ['=>', 0, [['[]', [1, 2]]], ['frame', 0]])
        // a function over a capture that changed, with nothing of its own to evaluate
        const [, , [inner], body] = closure(['=>', 1, [pair], ['[]', [['frame', 0], ['arg', 0]]]])
        same(inner, ['=>', 0, [['[]', [1, 2]]], ['frame', 0]])
        same(body, ['[]', [['frame', 0], ['arg', 0]]])
    },
    openComma: () => {
        // `f => (f(), f)` has nothing evaluated ahead and stays as it is
        /** @type {Closure} */
        const fn = ['=>', 1, [], [',', [['()', ['arg', 0], []], ['arg', 0]]]]
        assert(run(fn) === fn)
    },
    refused: () => {
        // a node under two functions is no body the analysis reads
        /** @type {Exp} */
        const n = ['[]', []]
        /** @type {Closure} */
        const fn = ['=>', 0, [], ['[]', [n, ['=>', 0, [], n]]]]
        assert(run(fn) === fn)
    },
    values: () => {
        // a value reached twice is answered once, in an array and an object
        const value = run(['[]', [pair, ['{}', [[':', 'a', pair]]], 1, ['undefined'], ['=>', 0, [pair], ['frame', 0]]]])
        const [, [first, [, [[, , second]]], one, none, [, , [third]]]] = /** @type {readonly [string, readonly [Closure, readonly [string, readonly [readonly [string, string, Closure]]], number, unknown, Closure]]} */ (value)
        same(first, ['=>', 0, [['[]', [1, 2]]], ['frame', 0]])
        assert(first === second)
        assert(first === third)
        assertEq(one, 1)
        same(none, ['undefined'])
    },
}
