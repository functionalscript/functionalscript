import { disagreement, highlight, render, spansOf } from './module.f.mjs'
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
        assert(h.includes('<span data-token="identifier">a</span>'), h)
    },
    spelling: () => {
        // a string holding `//` is a string, and the quotes are kept
        const h = html('"a // b"')
        assert(h.includes('<span data-token="string">'), h)
        assert(!h.includes('comment'), h)
    },
    // Which characters each span covers, not only that the pieces rejoin: a
    // misplaced span still rejoins to the input, so the text alone cannot see it.
    covered: () => {
        /** @type {(text: string) => string} */
        const covered = text => JSON.stringify(spansOf(text).map(({ start, length, kind }) =>
            [kind, Array.from(text).slice(start, start + length).join('')]))
        // a character beyond U+FFFF counts once before it, in a string and in a comment
        assertEq(covered('"😀" 1n'), '[["string","\\"😀\\""],["number","1n"]]')
        assertEq(covered('😀 = x'), '[]')
        assertEq(covered('"😀" + abc'), '[["string","\\"😀\\""],["identifier","abc"]]')
        assertEq(covered('"😀" 1'), '[["string","\\"😀\\""],["number","1"]]')
        assertEq(covered('"😀" + 1'), '[["string","\\"😀\\""],["number","1"]]')
        assertEq(covered('/* 😀 */ true'), '[["comment","/* 😀 */"],["literal","true"]]')
        // every line terminator starts a line, and a CRLF starts one
        assertEq(covered('// c\r1'), '[["comment","// c"],["number","1"]]')
        assertEq(covered('"a\u2028b" + 1'), '[["string","\\"a\u2028b\\""],["number","1"]]')
        assertEq(covered('"a\u2029b" + 1'), '[["string","\\"a\u2029b\\""],["number","1"]]')
        assertEq(covered('1\r\n2\n3'), '[["number","1"],["number","2"],["number","3"]]')
        // a word after `.` or `?.` is a property name, an identifier whatever it spells
        assertEq(covered('a.true + a?.default + a . null + a./*c*/const'),
            '[["identifier","a"],["identifier","true"],["identifier","a"],["identifier","default"],["identifier","a"],["identifier","null"],["identifier","a"],["comment","/*c*/"],["identifier","const"]]')
        assertEq(covered('true.true'), '[["literal","true"],["identifier","true"]]')
        // names: letters, digits, `_` and `$`
        assertEq(covered('$0 + _a1 + Array'), '[["identifier","$0"],["identifier","_a1"],["identifier","Array"]]')
        // the literal words are literals, `NaN` and `Infinity` among them
        assertEq(covered('1 + NaN + Infinity + undefined'), '[["number","1"],["literal","NaN"],["literal","Infinity"],["literal","undefined"]]')
        assertEq(covered('const a = 1  \r\n/* x\r y */  \n// z\n"😀" 1n'),
            '[["keyword","const"],["identifier","a"],["number","1"],["comment","/* x\\r y */"],["comment","// z"],["string","\\"😀\\""],["number","1n"]]')
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
    spans: () => assertEq(JSON.stringify(spansOf('a /* x */ 1')),
        '[{"start":0,"length":1,"kind":"identifier"},{"start":2,"length":7,"kind":"comment"},{"start":10,"length":1,"kind":"number"}]'),
    render: () => {
        assertEq(render([]).length, 0)
        assertEq(JSON.stringify(render([['a', 'keyword'], [' b'], ['']])),
            '[["span",{"data-token":"keyword"},"a"]," b"]')
    },
    disagreement: () => {
        assertEq(disagreement([['const', 'keyword'], [' '], ['a', 'identifier'], [' = '], ['-1', 'number'], [';']]), null)
        // a name the producer left plain, and a word it marked as another kind
        assertEq(disagreement([['const', 'keyword'], [' a']]), 'marked [{"start":0,"length":5,"kind":"keyword"}], the tokenizer finds [{"start":0,"length":5,"kind":"keyword"},{"start":6,"length":1,"kind":"identifier"}], in const a')
        assertEq(disagreement([['x', 'keyword']]), 'marked [{"start":0,"length":1,"kind":"keyword"}], the tokenizer finds [{"start":0,"length":1,"kind":"identifier"}], in x')
    },
    refused: () => assertEq(highlight('1 @ 2').join('|'), '1 @ 2'),
}
