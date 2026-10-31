/**
 * The source AST and FAST demo: both panes for every shared example the
 * parser accepts, each drawn whole, and the parser's refusal in place of
 * both for one it does not.
 *
 * @import { Unknown } from '../../media/datajs/types.ts'
 */

import { _listing, _panes, demo } from './demo.f.mjs'
import { examples } from '../examples/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { occurrences } from '../../types/string/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.js'

export const proof = {
    demo: {
        // Every example the parser accepts draws as both trees, and no node
        // of either is one the shapes cannot describe.
        examples: () => {
            for (const [name, text] of examples) {
                const [kind, value] = _panes(text)
                if (kind === 'ok') {
                    assertEq(value.map(p => p.heading).join(), 'Source AST,FAST', name)
                    for (const { graph } of value) {
                        assert(!graph.nodes.some(n => n.kind === 'unsupported'), name)
                    }
                }
            }
        },
        // The page opens on the overview: two headed panes, each a graph
        // and its tree as DataJS, collapsed.
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('<h3>Source AST</h3>') && html.includes('<h3>FAST</h3>'), html)
            assertEq(occurrences('<svg')(html), 2)
            assertEq(occurrences('<summary>As DataJS</summary>')(html), 2)
        },
        // One binding, one node: `a` is declared once and read twice.
        sharing: () => {
            const [kind, value] = _panes('const a = [1]; export default [a, a];')
            assertEq(kind, 'ok')
            if (kind === 'ok') {
                const source = value[0].graph
                const a = source.nodes.filter(n => n.label === 'a')
                assertEq(a.length, 1)
                assertEq(source.edges.filter(e => e.to === a[0].id).length, 3)
            }
        },
        // Each imported name is a value of its own: `x` and `y`, imported
        // from one module, are two FAST bindings.
        importedNames: () => {
            const [kind, value] = _panes("import { x, y } from './dep.f.js'; export default [x, y];")
            assertEq(kind, 'ok')
            if (kind === 'ok') {
                const fast = value[1].graph
                const array = fast.nodes.filter(n => n.label === '[]')
                assertEq(array.length, 1)
                const [x, y] = fast.edges.filter(e => e.from === array[0].id).map(e => e.to)
                assert(x !== y, 'x and y are two bindings')
            }
        },
        // An unfinished module has neither tree: the parser's message stands
        // in place of both.
        refused: () => {
            const html = htmlToString(demo.view('export default {bad'))
            assert(html.includes('Refused:') && !html.includes('<h3>'), html)
        },
        // A value that is not DataJS is refused in the listing rather than
        // listed as nothing. No tree the compiler builds holds a function,
        // so the value is made here, outside the type it claims.
        notDataJs: () => {
            const html = htmlToString(['div', _listing(/** @type {Unknown} */ (/** @type {unknown} */ ({ f: () => 0 })))])
            assert(html.includes('Refused:') && html.includes('a function is not a DataJS value'), html)
        },
    },
}
