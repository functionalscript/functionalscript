/**
 * Execution semantics of `vm` — one section per operand shape, since that is
 * how `map`'s handlers are built (`o1`/`o2`/`o2lazy`), plus the nodes that
 * evaluate their operands themselves (`,`, `[]`, `{}`) and the four that are
 * still `todo`. This is the executing counterpart of `../proof.f.mjs`, which
 * pins what the schema *accepts*; nothing here validates.
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
    // `o2` — both operands evaluated, the group the `6945861` fix covers:
    // each of these returns a value, not the handler that would compute one.
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
    throw: {
        // The four `todo` handlers: calls, lambdas, and the two optional
        // chain nodes, which need the `lambdas` step machinery.
        call: () => ev(['()', ['undefined'], [], ['undefined']]),
        lambda: () => ev(['=>', ['undefined'], ['undefined']]),
        optionalPropertyAccessor: () => ev(['?.', ['undefined'], 'a', []]),
        optionalCall: () => ev(['?.()', ['undefined'], [], ['undefined'], []]),
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
