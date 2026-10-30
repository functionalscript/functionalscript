import { codeOutput, highlight, render, tsHighlight } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'

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
        assert(h.includes('<span data-token="identifier">a</span>'), h)
    },
    spelling: () => {
        // a string holding `//` is a string, and the quotes are kept
        const h = html('"a // b"')
        assert(h.includes('<span data-token="string">'), h)
        assert(!h.includes('comment'), h)
    },
    textIsKept: () => {
        for (const source of ['const a = 1  \n/* x\n y */  \n// z\n\n"é😀" 1n\n', '"😀" 1', '"😀" + 1', '// c\r1', '"a\u2028b" + 1', '1\r\n2']) {
            assertEq(text(highlight(source)), source)
        }
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
    render: () => {
        assertEq(render([]).length, 0)
        assertEq(JSON.stringify(render([['a', 'keyword'], [' b'], ['']])),
            '[["span",{"data-token":"keyword"},"a"]," b"]')
    },
    codeOutput: () => {
        const view = codeOutput('JavaScript module:', 'Copy JavaScript module')
        const shown = htmlToString(['div', ...view(ok([['export', 'keyword'], [' default 1;']]))])
        assert(shown.includes('JavaScript module:</p>'), shown)
        assert(shown.includes('<pre><span data-token="keyword">export</span> default 1;</pre>'), shown)
        assert(shown.includes('data-copy="export default 1;"'), shown)
        assert(shown.includes('aria-label="Copy JavaScript module"'), shown)
        assert(!shown.includes('role="status"'), shown)
        const refused = htmlToString(['div', ...view(error('unexpected end'))])
        assert(refused.includes('role="status"'), refused)
        assert(refused.includes('unexpected end</pre>'), refused)
        assert(!refused.includes('JavaScript module'), refused)
    },
    signedLeaves: () => {
        // Producers own the whole literal, including its sign; the JS
        // tokenizer treats the sign as a separate, unmarked unary operator.
        assertEq(htmlToString(['pre', ...render([['-0', 'number'], [' '], ['-Infinity', 'literal']])]),
            '<!DOCTYPE html><pre><span data-token="number">-0</span> <span data-token="literal">-Infinity</span></pre>')
        assertEq(html('-0 -Infinity'),
            '<!DOCTYPE html><pre>-<span data-token="number">0</span> -<span data-token="literal">Infinity</span></pre>')
    },
    refused: () => assertEq(highlight('1 @ 2').join('|'), '1 @ 2'),
    // TypeScript's own words are keywords; the text is kept.
    typeScript: () => {
        const h = htmlToString(['pre', ...tsHighlight('type A = 1\n')])
        assert(h.includes('<span data-token="keyword">type</span>'), h)
        assertEq(text(tsHighlight('type A = 1\n')), 'type A = 1\n')
    },
}
