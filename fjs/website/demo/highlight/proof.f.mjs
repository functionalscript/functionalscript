import { highlight, render, spansOf } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {(nodes: readonly import('../../../media/html/types.ts').Node[]) => string} */
const text = nodes => nodes.map(n => typeof n === 'string' ? n : n.slice(n.length === 3 ? 2 : 1).join('')).join('')

/** @type {(source: string) => string} */
const html = source => htmlToString(['pre', ...highlight(source)])

export const proof = {
    kinds: () => {
        const h = html('export const a = [true, null, 12, 3n, "s", \'t\'] // note')
        assert(h.includes('<span data-token="keyword">export</span>'), h)
        assert(h.includes('<span data-token="keyword">const</span>'), h)
        assert(h.includes('<span data-token="literal">true</span>'), h)
        assert(h.includes('<span data-token="literal">null</span>'), h)
        assert(h.includes('<span data-token="number">12</span>'), h)
        assert(h.includes('<span data-token="number">3n</span>'), h)
        assert(h.includes('<span data-token="string">&quot;s&quot;</span>'), h)
        assert(h.includes(`<span data-token="string">'t'</span>`), h)
        assert(h.includes('<span data-token="comment">// note</span>'), h)
        assert(h.includes(' a '), h)
    },
    spelling: () => {
        // a string holding `//` is a string, and the quotes are kept
        const h = html('"a // b"')
        assert(h.includes('<span data-token="string">'), h)
        assert(!h.includes('comment'), h)
    },
    textIsKept: () => {
        const source = 'const a = 1  \n/* x\n y */  \n// z\n\n"é😀" 1n\n'
        assertEq(text(highlight(source)), source)
    },
    trailingBlanks: () => {
        const nodes = highlight('const  \n')
        assertEq(nodes[0] instanceof Array && nodes[0][2], 'const')
        assertEq(nodes.slice(1).join(''), '  \n')
    },
    blockComment: () => {
        const h = html('/* a\nb */ 1')
        assert(h.includes('<span data-token="comment">/* a\nb */</span>'), h)
        assert(h.includes('<span data-token="number">1</span>'), h)
    },
    empty: () => assertEq(highlight('').length, 0),
    spans: () => assertEq(JSON.stringify(spansOf('a /* x */ 1')),
        '[{"start":2,"length":7,"kind":"comment"},{"start":10,"length":1,"kind":"number"}]'),
    render: () => {
        assertEq(render([]).length, 0)
        assertEq(JSON.stringify(render([['a', 'keyword'], [' b'], ['']])),
            '[["span",{"data-token":"keyword"},"a"]," b"]')
    },
    refused: () => assertEq(highlight('1 @ 2').join('|'), '1 @ 2'),
}
