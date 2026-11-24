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

const run = precompute(undefined)

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
        same(run(fn), fn)
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
        same(run(fn), fn)
    },
    leaves: () => {
        // a read of a slot and a node with no operand are left where they are
        /** @type {Closure} */
        const fn = ['=>', 1, [7], ['[]', [['arg', 0], ['frame', 0], ['undefined']]]]
        same(run(fn), fn)
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
        // `x => [y => [x, y, [1]], () => 2 + 2]`: an open function's body is
        // left as written, a closed function is made once and precomputed
        // no further
        /** @type {Exp} */
        const inner = ['[]', [['frame', 0], ['arg', 0], ['[]', [1]]]]
        /** @type {Exp} */
        const constant = ['=>', 0, [], ['+', 2, 2]]
        /** @type {Closure} */
        const fn = ['=>', 1, [], ['[]', [['=>', 1, [['arg', 0]], inner], constant]]]
        const result = closure(fn)
        same(result, ['=>', 1, [['=>', 0, [], ['+', 2, 2]]], ['[]', [['=>', 1, [['arg', 0]], inner], ['frame', 0]]]])
        const [, [open]] = /** @type {readonly [string, readonly Closure[]]} */ (apply(result, [3]))
        assert(open[3] === inner)
    },
    refused: () => {
        // a node under two functions is no body the analysis reads
        /** @type {Exp} */
        const n = ['[]', []]
        /** @type {Closure} */
        const fn = ['=>', 0, [], ['[]', [n, ['=>', 0, [], n]]]]
        same(run(fn), fn)
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
