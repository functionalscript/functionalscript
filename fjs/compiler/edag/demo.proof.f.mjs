/**
 * Compiler EDAG demo proofs: operand shapes, sharing and interactive tracing.
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 * @import { NodeShape } from '../../website/demo/graph/types.ts'
 */

import { graphOfText, _shapeOf, demo } from './demo.f.mjs'
import { examples } from '../examples/module.f.js'
import { _crossings, graphOf } from '../../website/demo/graph/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.js'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { occurrences } from '../../types/string/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'

/** SVG text tags, including their attributes and text but not the closing tag. @type {(html: string) => readonly string[]} */
const svgTextTags = html => html.split('<text ').slice(1).map(tag => tag.slice(0, tag.indexOf('</text>')))

/** Lazy source positions, counting base paths and inline cells once, without selection overlays. @type {(html: string) => number} */
const lazyPositions = html => html.split('<').filter(tag => tag.includes('data-graph-edge-kind="lazy"') && !tag.includes('data-graph-trace=""')).length

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
    demo: {
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
        // A node `_shapeOf` cannot describe is not dropped: the walk still
        // draws it, labeled by its own tag, with no outgoing edges. No
        // source reaches it today, so the hand-built `Exp` the
        // `shapeOf.unrecognizedTag` test above describes is carried one
        // level up here, to where a node is actually built rather than only
        // described.
        walk: {
            unsupported: () => {
                assertStructurallySame(graphOf(_shapeOf)(['new', ['a']]), {
                    nodes: [{ id: 0, kind: 'unsupported', label: 'new (not yet drawn)', rank: 0 }],
                    edges: [],
                })
            },
            // A method call from source: the parser lowers `[1, 2, 3].at(0)`
            // to the continuation the hand-built `shapeOf.dot.methodCall`
            // spells, so the page draws it as one node of two links, `.`
            // with the key `at` and `()`, and nothing falls back.
            methodCall: () => {
                const html = htmlToString(demo.view('export default [1, 2, 3].at(0);'))
                assertEq(occurrences('data-graph-group=""')(html), 2)
                const labels = svgTextTags(html).filter(tag => tag.includes('data-graph-label=""'))
                assert(labels.some(tag => tag.endsWith('>.')) && labels.some(tag => tag.endsWith('>()')), html)
                assert(html.includes('data-graph-value-label="">&quot;at&quot;<') && !html.includes('not yet drawn'), html)
            },
            // The chains from source: each is the one node the parser
            // folds it into, a cell per link, and the one lazy edge is the
            // guarded call's arguments — `?.a.b` has only its receiver,
            // read regardless.
            chains: () => {
                const html = htmlToString(demo.view('const n = null; export default [n?.a.b, n?.(1)];'))
                const labels = svgTextTags(html).filter(tag => tag.includes('data-graph-label=""'))
                assert(labels.some(tag => tag.endsWith('>?.')) && labels.some(tag => tag.endsWith('>?.()')), html)
                assert(html.includes('data-graph-value-label="">&quot;a&quot;<') && html.includes('data-graph-value-label="">&quot;b&quot;<'), html)
                assert(!html.includes('not yet drawn'), html)
                assertEq(lazyPositions(html), 1)
            },
            // An input with no user to sit in — the whole walk — is still
            // drawn, as the terminal node it is. No source the parser
            // accepts exports a bare input, so the `Exp` is built by hand.
            terminalRoot: () => {
                const { nodes } = graphOf(_shapeOf)(['args'])
                assertStructurallySame(nodes, [{ id: 0, kind: 'terminal', label: 'args', rank: 0 }])
            },
            // A childless operator — an empty array literal — is a value
            // of its own, not an input, and stays a node.
            emptyArrayIsANode: () => {
                const { nodes } = graphOf(_shapeOf)(['[]', [['[]', []]]])
                assertStructurallySame(nodes, [{ id: 0, kind: 'op', label: '[]', rank: 0 }, { id: 1, kind: 'op', label: '[]', rank: 1 }])
            },
        },
        // Tracing follows every logical operand connection, including
        // shared uses, without inventing connections for inline values.
        tracing: () => {
            const source = /** @type {const} */ ('const a = 1 + 2; export default [a, a * 3];')
            const graph = unwrap(graphOfText(source))
            const html = htmlToString(demo.view(source))
            assertEq(occurrences(' data-graph-connection=')(html), graph.edges.filter(edge => typeof edge.to === 'number').length)
            assert(html.includes('data-graph-trace-layer=""'), html)
            assert(html.includes('data-graph-port-outline='), html)
            assert(html.includes('data-graph-node-name='), html)
            assert(html.includes('tabindex="0" role="group"'), html)
            assert(html.includes('data-graph-from=') && html.includes('data-graph-to='), html)
        },
        // The initial source is the demo's whole reason for being: `a` is
        // one `+` node reached by six edges, not six nodes that happen
        // to match.
        sharing: () => {
            const html = htmlToString(demo.view(demo.init))
            const texts = svgTextTags(html)
            const plusLabels = texts.filter(tag => tag.includes('data-graph-label=""') && tag.endsWith('>+'))
            assertEq(plusLabels.length, 1) // one `+` node, however many edges reach it
            // The five edges into it from beside a value name it in their
            // rows: the array's `0` and `1`, `a.x`'s `obj`, and `a * 3`'s
            // and `a < 4`'s `left`.
            assertEq(texts.filter(tag => tag.includes('data-graph-value-ref=""') && tag.endsWith('>+')).length, 5)
            // Every edge ends at the middle of its target's left side, level
            // with its label, so the lines that end at the `+` box's left
            // edge and the `+` label's height are the ones that reach it:
            // `a.x`'s `obj`, `0`, `1`, `a * 3`'s and `a < 4`'s `left`, and
            // `a < 4 && a`'s `right`, each from a port of its own. The box
            // is the one whose left starts the label's column and whose
            // middle is the label's height: the `+` box has ports, so its
            // label is a 24px column, 12px left of the label's centre.
            const [, xText, , yText] = plusLabels[0].split('"')
            const x = Number(xText)
            const y = Number(yText)
            const box = html.split('<rect x="').slice(1)
                .map(r => r.split('"'))
                .find(([rx, , ry, , , , h]) => Number(ry) + Number(h) / 2 === y && Number(rx) + 12 === x)
            const left = assertNotNullish(box, html)[0]
            assertEq(occurrences(`L${left},${y}" data-graph-edge=""`)(html), 6)
        },
        // The same source carries one of every look the drawing has, so a
        // reader meets all three before typing anything: an operator
        // hollow, a primitive tinted in its user's port, an input filled in
        // its user's port. `undefined` is among the primitives rather than
        // drawn as the zero-operand operator its `Op0Id` grouping would
        // otherwise make it. The input is the function's own `rest`: no box
        // of its own, since a reference's scope already says which input it
        // is.
        // The `=>` has no frame port, since it captures nothing, and its
        // `rest` body cell is marked lazy, as the line to it was.
        kinds: () => {
            const html = htmlToString(demo.view(demo.init))
            assertEq(occurrences('data-graph-kind="terminal"')(html), 0)
            assertEq(occurrences('data-graph-kind="leaf"')(html), 0)
            assert(html.includes('data-graph-value="" data-graph-value-kind="terminal" data-graph-edge-kind="lazy">'), html)
            assert(html.includes('data-graph-value-label="" data-graph-value-kind="terminal">rest<'), html)
            assert(html.includes('data-graph-value-label="">undefined<'), html)
            // `1`, `2`, `3`, `4`, `undefined`, the key `"x"`, the length
            // `0`, and `rest`, each in a cell; only the input is a terminal.
            // The other eight cells name nodes, preserving shared operand references.
            const refs = occurrences('data-graph-value-label="" data-graph-value-ref=""')(html)
            assertEq(refs, 8)
            assertEq(occurrences('data-graph-value=""')(html) - refs, 8)
            assertEq(occurrences('data-graph-value="" data-graph-value-kind="terminal"')(html), 1)
            assert(!html.includes('>frame'), html)
            assert(html.includes('>body<'), html)
        },
        /**
         * **The initial source draws the marking and the reason for it.**
         * `a` is reached four times — twice by the array, once through
         * `a * 3`, and once as `m && a`'s right operand — so one node
         * carries three solid lines and one broken, each from a port of its
         * own. A mark on the box could not have said which of the four was
         * conditional. The selected-left arm returns the established test;
         * the function's body has its own broken line.
         */
        // The initial source has two edges that skip ranks — the array's
        // `0` and `1`, reaching `+` past the row `*` sits in — and neither
        // passes through a box: each runs down a lane of its own.
        noEdgeCrossesABox: () => {
            assertEq(_crossings(unwrap(graphOfText(demo.init))), 0)
        },
        lazyEdgeInTheInitialSource: () => {
            const html = htmlToString(demo.view(demo.init))
            assertEq(lazyPositions(html), 3)
        },
        /**
         * Every lazy position, through the parser rather than by hand —
         * which the compiler accepts since Stage B landed.
         */
        lazyThroughTheParser: () => {
            // Each function contributes its lazy body edge. Logical results add
            // both conditional arms; nullishness also tests undefined lazily.
            const of = /** @type {(src: string) => number} */(src =>
                lazyPositions(htmlToString(demo.view(src))) - 1)
            assertEq(of('export default (...a) => a[0] && a[1];'), 2)
            assertEq(of('export default (...a) => a[0] || a[1];'), 2)
            assertEq(of('export default (...a) => a[0] ?? a[1];'), 4)
            // Both arms of a conditional, and neither its condition.
            assertEq(of('export default (...a) => a[0] ? a[1] : a[2];'), 2)
            // An eager operator marks nothing.
            assertEq(of('export default (...a) => a[0] + a[1];'), 0)
            // A chain's region: the argument of a call after a `?.`, of a
            // guarded call on an access and of a guarded call on a value;
            // not the argument of a call whose parentheses ended the
            // region, and not the receiver of a guarded access.
            assertEq(of('export default (...a) => a[0]?.b(a[1]);'), 1)
            assertEq(of('export default (...a) => a[0].b?.(a[1]);'), 1)
            assertEq(of('export default (...a) => a[0]?.(a[1]);'), 1)
            assertEq(of('export default (...a) => (a[0]?.b)(a[1]);'), 0)
            assertEq(of('export default (...a) => a[0]?.b;'), 0)
            // The body of a function that may never be called, as the
            // review that found it wrote it.
            assertEq(of('export default (...a) => null.x;'), 0)
        },
        // Arithmetic, comparison, a call and property access, all through
        // real source — the parser accepts this much today.
        realSource: () => {
            const html = htmlToString(demo.view(
                'const a = {x: 1}; const f = a.x; export default [f(2), a.x === 1];'))
            assert(html.includes('>()<'), html)
            assert(html.includes('>&quot;x&quot;<'), html)
            assert(html.includes('>===<'), html)
        },
        // A primitive with no user to sit in — the whole export — is still
        // drawn, as a leaf node of its own; `undefined` too, though the
        // EDAG holds it as an operator rather than a `Primitive`.
        leafRoot: () => {
            for (const [src, label] of [['export default 1;', '1'], ['export default undefined;', 'undefined']]) {
                const html = htmlToString(demo.view(src))
                assert(html.includes(`data-graph-kind="leaf"`), html)
                assert(html.includes(`>${label}<`), html)
                assert(!html.includes('data-graph-value'), html)
            }
        },
        // A bigint leaf carries its own suffix into the label rather than
        // being coerced like every other leaf `String(exp)` already covers.
        bigintLeaf: () => {
            const html = htmlToString(demo.view('export default 5n;'))
            assert(html.includes('>5n<'), html)
        },
        // An unused const is anchored as a comma's first operand rather
        // than dropped, so the export default is not the whole EDAG.
        commaAnchorsAnUnusedConst: () => {
            const html = htmlToString(demo.view('const unused = 5; export default 1;'))
            assert(html.includes('>,<'), html)
            assert(html.includes('>5<'), html)
            assert(html.includes('>1<'), html)
        },
        /**
         * **The initial source draws a comma**, so a reader meets the two
         * roles before typing anything. `checked` is the one thing the
         * export does not reach, which is what the compiler anchors.
         */
        commaRolesInTheInitialSource: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('>,<'), html)
            assert(html.includes('>anchor<'), html)
            assert(html.includes('>result<'), html)
        },
        // A module with named exports draws as the object of its exports,
        // not as `.default` read off that object.
        namedExports: () => {
            const html = htmlToString(demo.view('export const a = [];'))
            assert(html.includes('>{}<'), html)
            assert(html.includes('>a<'), html)
            assert(!html.includes('default'), html)
        },
        // A module that is a default and named exports is the object too:
        // its default is one of its ports.
        defaultAndNamedExports: () => {
            const html = htmlToString(demo.view('export const a = 1; export default 2;'))
            assert(html.includes('>{}<'), html)
            assert(html.includes('>default<'), html)
            assert(!html.includes('>.default<'), html)
        },
        // A parse failure is shown, not swallowed, and draws no graph.
        error: () => {
            const html = htmlToString(demo.view('export default {bad'))
            assert(html.includes('Refused:</p><pre data-result="error">'), html)
            assert(!html.includes('<svg'), html)
        },
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'edag', value: '1' })(''), '1')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
            // Picking an example replaces the text with its source.
            const [name, source] = examples[1]
            assertEq(step({ kind: 'input', name: 'example', value: name })('kept'), source)
        },
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="edag"'), html)
            assert(html.includes('name="example"'), html)
        },
        examples: {
            // The demo opens on the first, which is its overview.
            init: () => assertEq(demo.init, examples[0][1]),
            // Every example draws, except those the front end refuses —
            // and none of them draws a node the demo cannot describe, since
            // an example exists to show what it can.
            draw: () => {
                for (const [name, source] of examples) {
                    assertEq(graphOfText(source)[0] === 'ok', !['Hex escape', 'Non-breaking space', 'Non-ASCII identifier', 'Parse error'].includes(name), name)
                    assert(!htmlToString(demo.view(source)).includes('not yet drawn'), name)
                }
            },
            // A hexadecimal number and bigint draw as the values they spell:
            // the graph keeps the value, and the spelling stays in the text.
            hex: () => {
                const [, source] = assertNotNullish(examples.find(([name]) => name === 'Primitives'))
                assert(source.includes('0xFF') && source.includes('0x10n'), source)
                // the drawing, which follows the field: the field's coloured
                // copy of the source spells the hex digits
                const html = htmlToString(demo.view(source)).split('</textarea>')[1]
                assert(html.includes('>255<') && html.includes('>16n<'), html)
                assert(!html.includes('>0xFF<') && !html.includes('>0x10n<'), html)
            },
        },
    },
}
