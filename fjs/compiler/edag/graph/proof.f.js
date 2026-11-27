/**
 * How the walk reads one EDAG node, and what a module's text draws as.
 *
 * @import { NodeShape } from '../../../website/demo/graph/types.ts'
 */

import { graphOfText, _shapeOf } from './module.f.js'
import { graphOf } from '../../../website/demo/graph/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { unwrap } from '../../../types/result/module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'

/**
 * `exp`'s shape, asserted to be a node rather than a value drawn inline.
 *
 * @type {(exp: unknown, msg: string) => NodeShape<unknown>}
 */
const nodeShapeOf = (exp, msg) => {
    const shape = _shapeOf(exp)
    assert(hasEntry(shape, 'children'), msg)
    return shape
}

export const proof = {
    /**
     * `_shapeOf` against hand-built `Exp` values, not source text, for
     * the EDAG's own forms: the operators it shares with FAST are
     * proved where their shape is, `fjs/compiler/graph`. A tag no node
     * has is refused, and that path is tested here too.
     */
    shapeOf: {
        // Function length is metadata, not a third expression edge.
        // Building a closure establishes its frame and never its body,
        // which runs only on a call — so the body is marked.
        fixed: () => {
            assertStructurallySame(_shapeOf(['arg', 2]), { inline: 'arg 2', kind: 'terminal' })
            assertStructurallySame(_shapeOf(['frame', 1]), { inline: 'frame 1', kind: 'terminal' })
        },
        lambda: () => {
            const shape = nodeShapeOf(['=>', 0, [], ['rest']], 'expected a shape')
            assertEq(shape.label, '=>')
            assertStructurallySame(shape.children, [['length', 0], ['body', ['rest'], 'lazy']])
            // one port per slot, named as the body reads it
            const captures = nodeShapeOf(['=>', 0, [['[]', []], ['args']], ['frame', 1]], 'expected a shape')
            assertStructurallySame(captures.children, [['length', 0], ['frame 0', ['[]', []]], ['frame 1', ['args']], ['body', ['frame', 1], 'lazy']])
        },
        group: () => {
            const group = ['group', [9], [[0, ['self', 1]], [1, ['self', 0]]]]
            const drawing = graphOf(_shapeOf)(['fn', group, 0])
            assertStructurallySame(drawing.nodes.map(n => n.label), ['fn 0', 'group'])
            assertStructurallySame(drawing.edges.filter(e => e.back === true).map(e => [e.from, e.to, e.label, e.kind]), [
                [1, 1, 'body 0 (self 1)', 'lazy'], [1, 1, 'body 1 (self 0)', 'lazy'],
            ])
            assertStructurallySame(nodeShapeOf(group, 'group').children, [
                ['frame 0', 9], ['length 0', 0], ['body 0', ['self', 1], 'lazy'],
                ['length 1', 1], ['body 1', ['self', 0], 'lazy'],
            ])
            const shape = _shapeOf(['self', 0])
            assert(hasEntry(shape, 'owner'))
            assert(!shape.owner(group, 'frame 0'))
            assert(!shape.owner(['=>'], 'body 1'))
            assert(!shape.owner(null, 'body 1'))
        },
        // Every Op0 name the EDAG has of its own draws inline, and
        // the three part by meaning where `Op0Id` groups them by
        // operand count: `undefined` is a primitive and draws as the
        // leaf it is, beside `null` and the numbers, where `args` and
        // `rest` are two of the places a value enters a scope from
        // outside it and draw as terminals of their own — as a frame
        // slot does, above.
        op0: () => {
            for (const [tag, shape] of [
                ['undefined', { inline: 'undefined' }],
                ['args', { inline: 'args', kind: 'terminal' }],
                ['rest', { inline: 'rest', kind: 'terminal' }],
            ]) {
                assertStructurallySame(_shapeOf([tag]), shape, tag)
            }
        },
        // `throw` is an `op1` whose port names what the operand is to
        // the failure: its value, not an operand it computes from.
        thrown: () => {
            const thrown = nodeShapeOf(['throw', ['a']], 'throw')
            assertEq(thrown.label, 'throw')
            assertStructurallySame(thrown.children, [['value', ['a']]])
        },
        // An operator the EDAG shares with FAST is drawn by the shared
        // shape, under the EDAG's own array tag.
        shared: () => {
            const shape = nodeShapeOf(['.', ['a'], 'x', ['|()', [1]]], 'expected a shape')
            assertStructurallySame(shape.children, [['obj', ['a']], ['key', 'x'], ['...', ['[]', [1]]]])
        },
        // A tag naming none of the recognized shapes — one no node has
        // today — is drawn as itself.
        unrecognizedTag: () => assertStructurallySame(
            _shapeOf(['new', ['a']]),
            { kind: 'unsupported', label: 'new (not yet drawn)', children: [] }),
    },
    // `self` names its owner: the nearest `=>` entered through its `body`
    // port, and neither another port of one nor another node.
    self: () => {
        const shape = _shapeOf(['self'])
        assert(hasEntry(shape, 'owner'))
        const { owner } = shape
        assert(owner(['=>', 0, [], ['self']], 'body'))
        assert(!owner(['=>', 0, [], ['self']], 'frame 0'))
        assert(!owner(['[]', []], 'body'))
        assert(!owner(1, 'body'))
        // from source: a recursive function draws its call back to itself
        assertEq(unwrap(graphOfText('const f = n => f(n); export default f;')).nodes[0].label, '=>')
    },
    graphOfText: {
        // A module whose one export is its default draws as that value.
        defaultExport: () => {
            const { nodes } = unwrap(graphOfText('export default [[]];'))
            assertStructurallySame(nodes.map(node => node.label), ['[]', '[]'])
        },
        // A module with named exports draws as the object of its exports,
        // a default among them included.
        namedExports: () => {
            assertEq(unwrap(graphOfText('export const a = [];')).nodes[0].label, '{}')
            assertEq(unwrap(graphOfText('export const a = []; export default [];')).nodes[0].label, '{}')
        },
        // Text that does not parse, and text the lowering refuses, are the
        // compiler's message.
        refused: () => {
            assertEq(graphOfText('export default ;')[0], 'error')
            assertStructurallySame(graphOfText('export default 1==1;'), ['error', '== AST-to-FAST conversion is not implemented'])
        },
    },
}
