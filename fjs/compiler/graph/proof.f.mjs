/**
 * Shared operator shape proofs: the EDAG's spelling, which the EDAG demo
 * draws, and FAST's, which differs only in the array and object tags.
 * Then the FAST walker, over modules from source and, where no source
 * reaches a form yet, built by hand.
 *
 * @import { Graph, NodeShape } from '../../website/demo/graph/types.ts'
 * @import { BindingId, LoopTarget } from '../../js/ast/types.ts'
 * @import { Module } from '../../js/ast/sugar/types.ts'
 * @import { ResolvedModule } from '../parser/types.ts'
 */

import { fastGraph, operatorShape, sourceGraph, unsupported } from './module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { hasEntry } from '../../types/object/entry/module.f.js'

/** `text` as the graph of its FAST. @type {(text: string) => Graph} */
const ofText = text => {
    const resolved = assertOk(parse('')(text))
    return fastGraph(normalize(resolved, resolved.imports))
}

/** `text` as the graph of its source AST. @type {(text: string) => Graph} */
const sourceOf = text => sourceGraph(assertOk(parse('')(text)))

/** The id of the one node labelled `label`. @type {(g: Graph, label: string) => number} */
const nodeOf = (g, label) => {
    const found = g.nodes.filter(n => n.label === label)
    assertEq(found.length, 1, label)
    return found[0].id
}

/** The edges out of a node. @type {(g: Graph, id: number) => Graph['edges']} */
const from = (g, id) => g.edges.filter(e => e.from === id)

/** The edges into a node. @type {(g: Graph, id: number) => Graph['edges']} */
const into = (g, id) => g.edges.filter(e => e.to === id)

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
    terminalLoopSourceShape: () => {
        const graph = sourceOf('export default ()=>{while(true){return 1;}};')
        const loop = nodeOf(graph, 'terminal while')
        assertStructurallySame(from(graph, loop).map(edge => [edge.label, edge.kind]), [['cond', undefined], ['body', 'lazy']])
    },
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
        // An entry check's key is a spelling in the label, not a child:
        // the one edge is the operand's.
        in: () => {
            const shape = nodeShapeOf(['in', 'x', ['a']], 'expected a shape')
            assertEq(shape.label, '"x" in')
            assertStructurallySame(shape.children, [['operand', ['a']]])
        },
        op1: () => {
            for (const tag of ['String', 'Number', 'BigInt', '!', '~', 'typeof']) {
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
        memberPresent: () => assertStructurallySame(
            fast(['memberPresent', ['a'], 'x']),
            { kind: 'op', label: 'memberPresent', children: [['obj', ['a']], ['key', 'x']] }),
        call: () => assertStructurallySame(
            fast(['()', ['a'], [1]]),
            { kind: 'op', label: '()', children: [['callee', ['a']], ['...', ['array', [1]]]] }),
        edagTags: () => {
            assertStructurallySame(fast(['[]', []]), { kind: 'unsupported', label: '[] (not yet drawn)', children: [] })
            assertStructurallySame(fast(['{}', []]), { kind: 'unsupported', label: '{} (not yet drawn)', children: [] })
        },
    },
    walk: {
        deepOperators: () => {
            const g = ofText(`export default ${'!'.repeat(5_000)}true;`)
            assertEq(g.nodes.filter(n => n.label === '!').length, 5_000)
        },
        // A binding is one node however many references reach it: `a` is
        // defined once, captured by `f` and passed to it, so its node has
        // three edges in. The capture is a binding of `f`'s own, its node
        // an edge to the `a` it captures.
        closure: () => {
            const g = ofText('const a = [1]; const f = x => x && a; export default f(a);')
            const [a, f, , captured] = ['$0', '$1', '$2', '$3'].map(label => nodeOf(g, label))
            assertStructurallySame(into(g, a).map(e => e.label), ['define', 'captured', '0'])
            assertStructurallySame(from(g, captured).map(e => [e.label, e.to]), [['captured', a]])
            assertStructurallySame(from(g, f).map(e => e.label), ['value'])
            const fn = nodeOf(g, '=>')
            assertStructurallySame(from(g, fn).map(e => [e.label, e.kind]), [['param 0', undefined], ['capture 0', undefined], ['body', 'lazy']])
            // `&&` is a conditional, its arms lazy
            assertStructurallySame(from(g, nodeOf(g, 'if')).map(e => [e.label, e.kind]), [['cond', undefined], ['then', 'lazy'], ['else', 'lazy']])
            // the return is an arrow back to its function
            assertStructurallySame(from(g, nodeOf(g, 'return')).map(e => [e.label, e.to, e.back]), [['to', fn, true], ['value', nodeOf(g, 'if'), undefined]])
        },
        // A lazy binding's value is a dashed edge from its node.
        lazy: () => {
            const g = ofText('export default n => { let r = n; r = r + 1; const s = r; return () => s; };')
            assert(g.edges.some(e => e.label === 'value' && e.kind === 'lazy'), 'a lazy value')
        },
        // `rest` and `self` are rows of the function, bindings it defines.
        restAndSelf: () => {
            const g = ofText('const f = (n, ...r) => n < 1 ? r : f(n - 1); export default f;')
            assertStructurallySame(from(g, nodeOf(g, '=>')).map(e => e.label), ['param 0', 'rest', 'self', 'body'])
        },
        // `continue` and `break` arrow back to their loop, beside the
        // values they carry: `value` for one, numbered for several.
        loop: () => {
            const one = ofText('export default n => { let i = 0; while (i < n) { i = i + 1; } return i; };')
            const loop = nodeOf(one, 'loop')
            assertStructurallySame(from(one, loop).map(e => e.label), ['param 0', 'initial 0', 'result 0', 'body'])
            assertStructurallySame(from(one, nodeOf(one, 'continue')).map(e => [e.label, e.to, e.back]).slice(0, 1), [['to', loop, true]])
            assertStructurallySame(from(one, nodeOf(one, 'break')).map(e => e.label), ['to', 'value'])
            const two = ofText('export default n => { let i = 0; let s = 0; while (i < n) { s = s + i; i = i + 1; } return [i, s]; };')
            assertStructurallySame(from(two, nodeOf(two, 'break')).map(e => e.label), ['to', 'value 0', 'value 1'])
        },
        // A block's exit: a `throw` is a row, as a `yield` is.
        throws: () => {
            const g = ofText("export default () => { throw 'no'; };")
            assert(g.edges.some(e => e.label === 'throw'), 'a throw row')
        },
        // An import is a parameter of the module.
        imports: () => {
            const g = ofText("import b from './b.f.js'; export default b;")
            assertStructurallySame(from(g, nodeOf(g, 'module')).map(e => e.label), ['import 0', 'body'])
        },
        // Two names imported from one module are two values: each reads
        // its own binding, not one the module's specifier would make them
        // share.
        namesOfOneModule: () => {
            const g = ofText("import { x, y } from './dep.f.js'; export default [x, y];")
            const [x, y] = from(g, nodeOf(g, '[]')).map(e => e.to)
            assert(x !== y, 'x and y are two bindings')
        },
        /**
         * Forms no source reaches yet, built by hand: a block statement and
         * an `if` statement with results, a yield of two values, a block
         * value, and a tuple FAST does not have, drawn as itself.
         */
        handBuilt: () => {
            /** @type {(index: number) => BindingId} */
            const id = index => ({ index })
            const [x, r, y, z] = [id(0), id(0), id(0), id(0)]
            /** @type {Module} */
            const module = {
                parameters: [x],
                body: {
                    statements: [
                        ['block', [r], { statements: [], exit: ['yield', [['ref', x]]] }],
                        ['if', [y, z], ['ref', r], { statements: [], exit: ['yield', [1, 2]] }, { statements: [], exit: ['yield', [3, 4]] }],
                    ],
                    exit: ['yield', [['block', { statements: [], exit: ['yield', [['ref', z]]] }]]],
                },
            }
            const g = fastGraph(module)
            assertStructurallySame(g.nodes.filter(n => n.kind === 'binding').map(n => n.label), ['$0', '$1', '$2', '$3'])
            const statement = g.nodes.filter(n => n.label === 'block' && n.kind === 'op')
            assertEq(statement.length, 1)
            assertStructurallySame(from(g, statement[0].id).map(e => e.label), ['result 0', 'body'])
            assertStructurallySame(from(g, nodeOf(g, 'if')).map(e => e.label), ['result 0', 'result 1', 'cond', 'then', 'else'])
            assert(g.edges.some(e => e.label === 'yield 1'), 'a yield of two values')
            const unknown = fastGraph({ parameters: [], body: { statements: [], exit: ['yield', [/** @type {any} */ (['new', 1])]] } })
            assert(unknown.nodes.some(n => n.label === 'new (not yet drawn)'), 'drawn as itself')
        },
        // A reference to a binding the module does not define is refused,
        // not drawn as an empty box.
        throw: {
            unbound: () => {
                fastGraph({ parameters: [], body: { statements: [], exit: ['yield', [['ref', { index: 0 }]]] } })
            },
        },
    },
    source: {
        // A binding is one node, named as the source names it: `a` is
        // initialized once and read twice. The pattern of a plain `const`
        // is one `=` row.
        sharing: () => {
            const g = sourceOf('const a = [1]; export default [a, a];')
            const a = nodeOf(g, 'a')
            assertStructurallySame(into(g, a).map(e => e.label), ['=', '0', '1'])
            assertStructurallySame(from(g, nodeOf(g, 'initialize')).map(e => e.label), ['=', 'value'])
        },
        // A destructuring pattern reads into temporaries, `$n` by their
        // place among the module's bindings, and then the names: a spread
        // copy first, then items by index and members by key.
        destructuring: () => {
            const g = sourceOf('const [p, { q }] = [1, { q: 2 }]; export default [p, q];')
            assertStructurallySame(from(g, nodeOf(g, 'initialize')).map(e => e.label), ['...=', '0[0]', '0[1]', '2.q', 'value'])
            assertStructurallySame(g.nodes.filter(n => n.kind === 'binding').map(n => n.label), ['$0', 'p', '$2', 'q'])
        },
        // A read of a static function, with no value to read from.
        static: () => {
            const g = sourceOf('const { entries } = Object; export default entries;')
            assertStructurallySame(from(g, nodeOf(g, 'initialize')).map(e => e.label), ['Object.entries', 'value'])
        },
        // A parameter that binds one name with no default is that binding;
        // one with a pattern or a default is a node of its reads, its
        // default lazy. `length` is a value; the body is lazy.
        parameters: () => {
            const g = sourceOf('export default (x, { y }, { z } = {}, ...r) => [x, y, z, r];')
            const fn = nodeOf(g, '=>')
            assertStructurallySame(from(g, fn).map(e => [e.label, e.kind]), [['length', undefined], ['param 0', undefined], ['param 1', undefined], ['param 2', undefined], ['rest', undefined], ['body', 'lazy']])
            assertEq(from(g, fn)[1].to, nodeOf(g, 'x'))
            assertEq(from(g, fn)[4].to, nodeOf(g, 'r'))
            const params = g.nodes.filter(n => n.label === 'param')
            assertStructurallySame(params.map(n => from(g, n.id).map(e => [e.label, e.kind])), [
                [['=', undefined], ['0.y', undefined]],
                [['=', undefined], ['0.z', undefined], ['default', 'lazy']],
            ])
        },
        // A recursive function reads itself through `self`, and its return
        // arrows back to it.
        recursion: () => {
            const g = sourceOf('const fact = n => n < 2 ? 1 : n * fact(n - 1); export default fact(5);')
            const fn = nodeOf(g, '=>')
            assert(from(g, fn).some(e => e.label === 'self'), 'self')
        },
        // `let`, `while`, `if`, `break`, `write` and `return`, each a node,
        // and `&&` still itself, its right operand lazy.
        statements: () => {
            const g = sourceOf('export default x => { let s = x; while (s < 3) { if (s > 1) { break; } s = s + 1; } return x && s; };')
            const loop = nodeOf(g, 'while')
            assertStructurallySame(from(g, loop).map(e => [e.label, e.kind]), [['cond', undefined], ['body', 'lazy']])
            assertStructurallySame(from(g, nodeOf(g, 'break')).map(e => [e.label, e.to, e.back]), [['to', loop, true]])
            assertStructurallySame(from(g, nodeOf(g, 'write')).map(e => [e.label, e.to]), [['to', nodeOf(g, 's')], ['value', nodeOf(g, '+')]])
            assertStructurallySame(from(g, nodeOf(g, 'if')).map(e => e.kind), [undefined, 'lazy', 'lazy'])
            assertStructurallySame(from(g, nodeOf(g, '&&')).map(e => [e.label, e.kind]), [['left', undefined], ['right', 'lazy']])
            assertStructurallySame(from(g, nodeOf(g, 'return')).map(e => [e.label, e.back]), [['to', true], ['value', undefined]])
        },
        compoundAssignments: () => {
            for (const tag of ['+', '&&', '||', '??']) {
                const g = sourceOf(`export default (value,right)=>{value ${tag}= right;return value;};`)
                const assignment = nodeOf(g, `${tag}=`)
                const edges = from(g, assignment)
                assertStructurallySame(edges.map(e => e.label), ['to', 'left', 'right'])
                assertEq(edges[0].to, nodeOf(g, 'value'))
                assertEq(edges[1].to, nodeOf(g, 'value'))
                assertEq(edges[2].to, nodeOf(g, 'right'))
                assertEq(edges[2].kind, tag === '+' ? undefined : 'lazy')
            }
        },
        // `||` and `??` as `&&` is, and `continue` back to its loop.
        logical: () => {
            const g = sourceOf('export default (a, b) => { let i = 0; while (i < 3) { i = i + 1; if (a) { continue; } } return [a || b, a ?? b]; };')
            assertStructurallySame(from(g, nodeOf(g, 'continue')).map(e => [e.label, e.to]), [['to', nodeOf(g, 'while')]])
            assertEq(from(g, nodeOf(g, '||'))[1].kind, 'lazy')
            assertEq(from(g, nodeOf(g, '??'))[1].kind, 'lazy')
        },
        // A `switch` exit: its value, then each case and `default`, lazy.
        // A case is its labels and its body; the default throws.
        switch: () => {
            const g = sourceOf('export default node => { switch (node[0]) { case "array": case "object": { return "container"; } default: { throw ["unknown", node[0]]; } } };')
            const sw = nodeOf(g, 'switch')
            assertStructurallySame(from(g, sw).map(e => [e.label, e.kind]), [['value', undefined], ['case 0', 'lazy'], ['default', 'lazy']])
            assertStructurallySame(from(g, nodeOf(g, 'case')).map(e => [e.label, e.kind]), [['label 0', undefined], ['label 1', 'lazy'], ['body', 'lazy']])
            assert(g.edges.some(e => e.label === 'throw'), 'a throw row')
        },
        effectfulCaseLabels: () => {
            const g = sourceOf('export default (x, f, g) => { switch (x) { case f(): case g(): { return 1; } default: { return 0; } } };')
            const edges = from(g, nodeOf(g, 'case'))
            assertStructurallySame(edges.map(e => [e.label, e.kind]), [['label 0', undefined], ['label 1', 'lazy'], ['body', 'lazy']])
            assertEq(g.nodes.filter(n => n.label === '()').length, 2)
        },
        // A `switch` statement in a loop: its value, its cases and its
        // default, as the exit form has, and a `break` in a case arrows back
        // to the switch it leaves, a `continue` to the loop.
        loopSwitch: () => {
            const g = sourceOf('export default n => { let i = 0; while (i < n) { i = i + 1; switch (i) { case 0: { continue; } default: { break; } } } return i; };')
            const sw = nodeOf(g, 'switch')
            assertStructurallySame(from(g, sw).map(e => [e.label, e.kind]), [['value', undefined], ['case 0', 'lazy'], ['default', 'lazy']])
            assertStructurallySame(from(g, nodeOf(g, 'break')).map(e => [e.label, e.to, e.back]), [['to', sw, true]])
            assertStructurallySame(from(g, nodeOf(g, 'continue')).map(e => [e.label, e.to, e.back]), [['to', nodeOf(g, 'while'), true]])
        },
        // A `throw` statement, in a loop, is a node of its own.
        throwStatement: () => {
            const g = sourceOf('export default n => { let i = 0; while (i < n) { if (i > 5) { throw "big"; } i = i + 1; } return i; };')
            assertStructurallySame(from(g, nodeOf(g, 'throw')).map(e => e.label), ['value'])
        },
        // A conditional exit: an early `throw` makes the rest of the body
        // the `if`'s other arm, so the block ends in the `if`.
        conditionalExit: () => {
            const g = sourceOf('export default n => { if (n < 0) { throw "negative"; } return n; };')
            const block = g.nodes.filter(n => n.label === 'block')
            assert(block.some(b => from(g, b.id).some(e => e.label === 'if' && e.to === nodeOf(g, 'if'))), 'an if exit')
        },
        // An import is a row of the module named by its specifier; one that
        // binds no name is the module it loads, a terminal.
        imports: () => {
            const g = sourceOf('import b from "./b.f.js"; import {} from "./c.f.js"; export default b;')
            assertStructurallySame(from(g, nodeOf(g, 'module')).map(e => [e.label, typeof e.to === 'number' ? e.to : e.to.inline]), [['./b.f.js', nodeOf(g, 'b')], ['./c.f.js', '{}'], ['body', nodeOf(g, 'block')]])
        },
        /**
         * Forms no source reaches yet, built by hand: a `rest` pattern, a
         * block value, and a tuple the source AST does not have, drawn as
         * itself.
         */
        handBuilt: () => {
            const [a, b] = [{ index: 0 }, { index: 1 }]
            const target = /** @type {const} */ ({ kind: 'function', index: 1 })
            /** @type {ResolvedModule} */
            const module = {
                imports: [],
                body: {
                    statements: [],
                    exit: ['yield', ['array', [
                        ['function', {
                            target, length: 0, parameters: [],
                            rest: { reads: [{ source: null, spread: true }, { source: [0, 0], spread: false }], ids: [a, b] },
                            self: null,
                            body: { statements: [], exit: ['return', target, ['block', { statements: [], exit: ['yield', ['ref', b]] }]] },
                        }],
                        /** @type {any} */ (['new', 1]),
                    ]]],
                },
                scope: { target, bindings: [], events: [] },
                bindings: [],
                origins: [
                    { id: a, name: null, kind: 'temporary', metadata: /** @type {any} */ (null) },
                    { id: b, name: 'b', kind: 'parameter', metadata: /** @type {any} */ (null) },
                ],
            }
            const g = sourceGraph(module)
            assertStructurallySame(from(g, nodeOf(g, 'pattern')).map(e => e.label), ['...=', '0[0]'])
            assert(g.nodes.some(n => n.label === 'new (not yet drawn)'), 'drawn as itself')
        },
        // A binding the parser has no origin for is refused.
        throw: {
            unknownBinding: () => {
                sourceGraph({ imports: [], body: { statements: [], exit: ['yield', ['ref', { index: 0 }]] }, scope: { target: { kind: 'function', index: 0 }, bindings: [], events: [] }, bindings: [], origins: [] })
            },
        },
    },
}

