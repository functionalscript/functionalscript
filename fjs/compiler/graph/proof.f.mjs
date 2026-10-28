/**
 * Shared operator shape proofs: the EDAG's spelling, which the EDAG demo
 * draws, and FAST's, which differs only in the array and object tags.
 *
 * @import { NodeShape } from '../../website/demo/graph/types.ts'
 */

import { operatorShape, unsupported } from './module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { hasEntry } from '../../types/object/entry/module.f.js'

const edag = operatorShape({ array: '[]', object: '{}' })(unsupported)

const fast = operatorShape({ array: 'array', object: 'object' })(unsupported)

/**
 * `exp`'s EDAG shape, asserted to be a node rather than a value drawn
 * inline.
 *
 * @type {(exp: unknown, msg: string) => NodeShape<unknown>}
 */
const nodeShapeOf = (exp, msg) => {
    const shape = edag(exp)
    assert(hasEntry(shape, 'children'), msg)
    return shape
}

export const proof = {
    /**
     * The shape against hand-built tuples in the EDAG's spelling, not source
     * text: most of these tags — every `Op1`, some of `Op2`, a spread, a
     * computed object key — have no `export default <text>;` that reaches
     * them yet, so this is the only way to the whole shape rather than only
     * its currently-reachable half.
     */
    edag: {
        array: {
            plain: () => {
                const shape = nodeShapeOf(['[]', [1, 2]], 'expected a shape')
                assertEq(shape.label, '[]')
                assertStructurallySame(shape.children, [['0', 1], ['1', 2]])
            },
            // A spread item is one child, named by its position rather
            // than by an index that would claim it names one array slot.
            spread: () => {
                const shape = nodeShapeOf(['[]', [['...', ['a']]]], 'expected a shape')
                assertStructurallySame(shape.children, [['...0', ['a']]])
            },
        },
        object: {
            // A literal string key becomes the edge label; no separate
            // node for it, the same economy the DataJS demo spends on
            // object keys.
            literalKey: () => {
                const shape = nodeShapeOf(['{}', [[':', 'x', 1]]], 'expected a shape')
                assertStructurallySame(shape.children, [['x', 1]])
            },
            // A computed key is itself an `Exp` with nothing to fold
            // into a label, so it gets a node of its own, alongside the
            // value's.
            computedKey: () => {
                const shape = nodeShapeOf(['{}', [[':', ['a'], 1]]], 'expected a shape')
                assertStructurallySame(shape.children, [['key0', ['a']], ['value0', 1]])
            },
            spread: () => {
                const shape = nodeShapeOf(['{}', [['...', ['a']]]], 'expected a shape')
                assertStructurallySame(shape.children, [['...0', ['a']]])
            },
        },
        dot: {
            // A literal key is a value of the `.` node, not part of its
            // label: a name in its `key` port, an index in its `idx`.
            literalString: () => {
                const shape = nodeShapeOf(['.', ['a'], 'x'], 'expected a shape')
                assertEq(shape.label, '.')
                assertStructurallySame(shape.children, [['obj', ['a']], ['key', 'x']])
            },
            literalNumber: () => {
                const shape = nodeShapeOf(['.', ['a'], 5], 'expected a shape')
                assertEq(shape.label, '.')
                assertStructurallySame(shape.children, [['obj', ['a']], ['idx', 5]])
            },
            // A computed index — `Number(x)`, the one shape `Index`
            // allows beyond a bare literal — is an `Exp`, so it gets a
            // child edge the way a computed object key does.
            computed: () => {
                const shape = nodeShapeOf(['.', ['a'], ['Number', ['b']]], 'expected a shape')
                assertEq(shape.label, '.')
                assertStructurallySame(shape.children, [['obj', ['a']], ['idx', ['Number', ['b']]]])
            },
            // A plain call continuation — a fourth element past the
            // ordinary form — is a method call, and draws as one node, a
            // table of its links: the access, its receiver in `obj` and
            // its key in `key`, as a plain `.` node's, and the call, its arguments
            // one `[]` node in its `...` row, a spread the `[]`'s own.
            methodCall: () => {
                const shape = nodeShapeOf(['.', ['a'], 'x', ['|()', [1, ['...', ['b']]]]], 'expected a shape')
                assertEq(shape.label, '.x()')
                assertStructurallySame(shape.children, [['obj', ['a']], ['key', 'x'], ['...', ['[]', [1, ['...', ['b']]]]]])
                assertStructurallySame(shape.groups, [['.', 2], ['()', 1]])
            },
            // A computed index is an `idx` edge, as a plain `.` node's is.
            computedMethodCall: () => {
                const shape = nodeShapeOf(['.', ['a'], ['Number', ['b']], ['|()', []]], 'expected a shape')
                assertEq(shape.label, '[]()')
                assertStructurallySame(shape.children, [['obj', ['a']], ['idx', ['Number', ['b']]], ['...', ['[]', []]]])
            },
            // A guarded call continuation opens a short-circuit region:
            // the receiver is read regardless, and the call's own
            // arguments are the first thing a nullish value skips, so
            // their edge is lazy where a plain method call's is not.
            guardedCall: () => {
                const shape = nodeShapeOf(['.', ['a'], 'x', ['|?.()', [1]]], 'expected a shape')
                assertEq(shape.label, '.x?.()')
                assertStructurallySame(shape.children, [['obj', ['a']], ['key', 'x'], ['...', ['[]', [1]], 'lazy']])
                assertStructurallySame(shape.groups, [['.', 2], ['?.()', 1]])
            },
            // The steps after a guarded call stay in its region.
            guardedCallSteps: () => {
                const shape = nodeShapeOf(['.', ['a'], 'b', ['|?.()', [['x']], ['|.', 'c', ['|()', [['y']]]]]], 'expected a shape')
                assertEq(shape.label, '.b?.().c()')
                assertStructurallySame(shape.children, [
                    ['obj', ['a']], ['key', 'b'],
                    ['...', ['[]', [['x']]], 'lazy'],
                    ['key', 'c'],
                    ['...', ['[]', [['y']]], 'lazy'],
                ])
                assertStructurallySame(shape.groups, [['.', 2], ['?.()', 1], ['.', 1], ['()', 1]])
            },
        },
        /**
         * **A chain is one node, a table of its links, and its region
         * is on the edges.** Every spelling of `fjs/edag`'s Chains
         * table that a `?.` or `?.()` node begins: a group of rows per
         * link, its operator beside them, the first link's two rows
         * naming the receiver or callee, and each operand lazy where a
         * nullish value would skip it. The label spells the chain, for
         * the rows of other nodes that name it.
         */
        chain: {
            // `a?.b`: the receiver is read regardless, and the key is a
            // value in the link's `key` row, as a plain `a.b`'s is.
            guardedAccess: () => {
                const shape = nodeShapeOf(['?.', ['a'], 'b'], 'expected a shape')
                assertEq(shape.label, '?.b')
                assertStructurallySame(shape.children, [['obj', ['a']], ['key', 'b']])
                assertStructurallySame(shape.groups, [['?.', 2]])
            },
            guardedNumber: () => {
                const shape = nodeShapeOf(['?.', ['a'], 0], 'expected a shape')
                assertEq(shape.label, '?.[0]')
                assertStructurallySame(shape.children, [['obj', ['a']], ['idx', 0]])
            },
            // A computed key is inside the region — `u?.[todo()]` never
            // runs `todo` — so its `idx` edge is lazy, where a plain
            // access's is not.
            guardedComputed: () => {
                const shape = nodeShapeOf(['?.', ['a'], ['Number', ['b']]], 'expected a shape')
                assertEq(shape.label, '?.[]')
                assertStructurallySame(shape.children, [['obj', ['a']], ['idx', ['Number', ['b']], 'lazy']])
            },
            // `a?.b.c(d, ...e)`: a row per step, and the call's
            // arguments are one `[]` node, its spread its own.
            steps: () => {
                const shape = nodeShapeOf(['?.', ['a'], 'b', ['|.', 'c', ['|()', [['d'], ['...', ['e']]]]]], 'expected a shape')
                assertEq(shape.label, '?.b.c()')
                assertStructurallySame(shape.children, [
                    ['obj', ['a']], ['key', 'b'],
                    ['key', 'c'],
                    ['...', ['[]', [['d'], ['...', ['e']]]], 'lazy'],
                ])
                assertStructurallySame(shape.groups, [['?.', 2], ['.', 1], ['()', 1]])
            },
            // `a?.b(x)(y)`: two calls in one chain are two links, each
            // with its own `[]`, where a port per argument gave both a
            // `(0)`.
            callOnACall: () => {
                const shape = nodeShapeOf(['?.', ['a'], 'b', ['|()', [['x']], ['|()', [['y']]]]], 'expected a shape')
                assertEq(shape.label, '?.b()()')
                assertStructurallySame(shape.children, [
                    ['obj', ['a']], ['key', 'b'],
                    ['...', ['[]', [['x']]], 'lazy'],
                    ['...', ['[]', [['y']]], 'lazy'],
                ])
                assertStructurallySame(shape.groups, [['?.', 2], ['()', 1], ['()', 1]])
            },
            // A computed key in a step is an `idx` edge as the first
            // link's is, and a numbered one a value in its `idx` row.
            computedStep: () => {
                const shape = nodeShapeOf(['?.', ['a'], 'b', ['|.', ['Number', ['c']], ['|.', 1]]], 'expected a shape')
                assertEq(shape.label, '?.b[][1]')
                assertStructurallySame(shape.children, [
                    ['obj', ['a']], ['key', 'b'],
                    ['idx', ['Number', ['c']], 'lazy'],
                    ['idx', 1],
                ])
                assertStructurallySame(shape.groups, [['?.', 2], ['.', 1], ['.', 1]])
            },
            // `(a?.b.c)(x)`: the parentheses ended the region, so the
            // call is its own `(?.)()` link and its arguments run
            // regardless — eager, after lazy steps.
            closingCall: () => {
                const shape = nodeShapeOf(['?.', ['a'], 'b', ['|.', 'c', ['|!()', [['x']]]]], 'expected a shape')
                assertEq(shape.label, '(?.b.c)()')
                assertStructurallySame(shape.children, [
                    ['obj', ['a']], ['key', 'b'],
                    ['key', 'c'],
                    ['...', ['[]', [['x']]]],
                ])
                assertStructurallySame(shape.groups, [['?.', 2], ['.', 1], ['(?.)()', 1]])
            },
            // `a?.(x)`: a guarded call's callee is read regardless and
            // its arguments are inside the region it opens.
            guardedCall: () => {
                const shape = nodeShapeOf(['?.()', ['a'], [['x']]], 'expected a shape')
                assertEq(shape.label, '?.()')
                assertStructurallySame(shape.children, [['callee', ['a']], ['...', ['[]', [['x']]], 'lazy']])
                assertStructurallySame(shape.groups, [['?.()', 2]])
            },
            // `a?.(x).d(y)`: the steps after it.
            guardedCallSteps: () => {
                const shape = nodeShapeOf(['?.()', ['a'], [['x']], ['|.', 'd', ['|()', [['y']]]]], 'expected a shape')
                assertEq(shape.label, '?.().d()')
                assertStructurallySame(shape.children, [
                    ['callee', ['a']], ['...', ['[]', [['x']]], 'lazy'],
                    ['key', 'd'],
                    ['...', ['[]', [['y']]], 'lazy'],
                ])
                assertStructurallySame(shape.groups, [['?.()', 2], ['.', 1], ['()', 1]])
            },
        },
        // A plain call is the same table's one link: the callee, and
        // its arguments one `[]` node.
        call: () => {
            const shape = nodeShapeOf(['()', ['a'], [['b'], ['...', ['c']]]], 'expected a shape')
            assertEq(shape.label, '()')
            assertStructurallySame(shape.children, [['callee', ['a']], ['...', ['[]', [['b'], ['...', ['c']]]]]])
        },
        /**
         * **A comma's operands are named, not numbered.** It establishes
         * all of them and takes the value of the last; the earlier ones
         * exist for their throw-potential only. Numbers showed five
         * equals where one is the answer and the rest only have to
         * happen.
         */
        comma: () => {
            const shape = nodeShapeOf([',', [1, 2, 3]], 'expected a shape')
            assertStructurallySame(shape.children, [
                ['anchor', 1], ['anchor', 2], ['result', 3]])
        },
        // Two is the shortest a canonical comma has: one anchor and the
        // value. A single operand would be the identity, which the
        // emitter does not write.
        commaOfTwo: () => {
            const shape = nodeShapeOf([',', [1, 2]], 'expected a shape')
            assertStructurallySame(shape.children, [['anchor', 1], ['result', 2]])
        },
        ternary: () => {
            const shape = nodeShapeOf(['?:', ['a'], 1, 2], 'expected a shape')
            assertEq(shape.label, '?:')
            // The condition always runs; exactly one arm does, so both
            // arms are marked.
            assertStructurallySame(shape.children, [
                ['cond', ['a']], ['then', 1, 'lazy'], ['else', 2, 'lazy']])
        },
        // Returning a left operand keeps the very same graph node in its
        // eager condition and its lazy selected-result position.
        selectedLeftOperand: () => {
            const left = /** @type {const} */ (['.', ['rest'], 0])
            const shape = nodeShapeOf(['?:', left, ['b'], left], 'selected left')
            assertStructurallySame(shape.children, [
                ['cond', left], ['then', ['b'], 'lazy'], ['else', left, 'lazy']])
            assert(shape.children[0][1] === shape.children[2][1])
        },
        // An eager binary operator marks neither operand.
        eagerOperandsAreUnmarked: () => {
            const shape = nodeShapeOf(['*', ['a'], ['b']], 'expected a shape')
            assertStructurallySame(shape.children, [['left', ['a']], ['right', ['b']]])
        },
        // The condition always runs; exactly one arm does.
        lazyArms: () => {
            const shape = nodeShapeOf(['?:', ['a'], ['b'], ['c']], 'expected a shape')
            assertStructurallySame(shape.children, [
                ['cond', ['a']], ['then', ['b'], 'lazy'], ['else', ['c'], 'lazy']])
        },
        // An instance check's constructor is a name in the label, not
        // a child: the one edge is the operand's.
        instanceOf: () => {
            const shape = nodeShapeOf(['instanceof', ['a'], 'Array'], 'expected a shape')
            assertEq(shape.label, 'instanceof Array')
            assertStructurallySame(shape.children, [['operand', ['a']]])
        },
        op1: () => {
            for (const tag of ['String', 'Number', '!', '~', 'typeof']) {
                const shape = nodeShapeOf([tag, ['a']], tag)
                assertEq(shape.label, tag)
                assertStructurallySame(shape.children, [['operand', ['a']]])
            }
        },
        // A sample across Op2's range, not all twenty tags: the
        // dispatch is one membership test per group, so one tag from
        // each syntactic corner — comparison, arithmetic, bitwise — is
        // what could vary.
        op2: () => {
            for (const tag of ['===', '*', '&']) {
                const shape = nodeShapeOf([tag, ['a'], ['b']], tag)
                assertEq(shape.label, tag)
                assertStructurallySame(shape.children, [['left', ['a']], ['right', ['b']]])
            }
        },
        op12: {
            unary: () => {
                const shape = nodeShapeOf(['-', ['a']], 'expected a shape')
                assertStructurallySame(shape.children, [['operand', ['a']]])
            },
            binary: () => {
                const shape = nodeShapeOf(['-', ['a'], ['b']], 'expected a shape')
                assertStructurallySame(shape.children, [['left', ['a']], ['right', ['b']]])
            },
        },
        // Every leaf operator draws inline, as the terminal it is.
        leaves: () => {
            for (const tag of ['entry', 'hasEntry', 'slice', 'charCodeAt']) {
                assertStructurallySame(edag([tag]), { inline: tag, kind: 'terminal' }, tag)
            }
        },
        primitive: () => {
            assertStructurallySame(edag(1), { inline: '1' })
            assertStructurallySame(edag(null), { inline: 'null' })
        },
        // A tuple the vocabulary does not share goes to the caller's shape.
        other: () => assertStructurallySame(
            edag(['new', ['a']]),
            { kind: 'unsupported', label: 'new (not yet drawn)', children: [] }),
    },
    /**
     * FAST's spelling: the same drawing under its own array and object
     * tags, a call's arguments an array node in FAST's tag, and the EDAG's
     * tags no operator of FAST's.
     */
    fast: {
        array: () => assertStructurallySame(fast(['array', [1, ['...', ['a']]]]), { kind: 'op', label: '[]', children: [['0', 1], ['...1', ['a']]] }),
        object: () => assertStructurallySame(fast(['object', [[':', 'x', 1]]]), { kind: 'op', label: '{}', children: [['x', 1]] }),
        call: () => assertStructurallySame(
            fast(['()', ['a'], [1]]),
            { kind: 'op', label: '()', children: [['callee', ['a']], ['...', ['array', [1]]]] }),
        edagTags: () => {
            assertStructurallySame(fast(['[]', []]), { kind: 'unsupported', label: '[] (not yet drawn)', children: [] })
            assertStructurallySame(fast(['{}', []]), { kind: 'unsupported', label: '{} (not yet drawn)', children: [] })
        },
    },
}
