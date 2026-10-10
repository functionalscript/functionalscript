import { chunkRun, chunkStrings, keyword, literal, chunkText, chunksMarked, chunksText, fromSpans, toText } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

/** @type {(text: string) => (spans: readonly import('./types.ts').Span[]) => unknown} */
const refused = text => spans => {
    const [kind, message] = fromSpans(text)(spans)
    assertEq(kind, 'error')
    return message
}

export const proof = {
    toText: {
        empty: () => assertEq(toText([]), ''),
        runs: () => assertEq(toText([['a', 'keyword'], [' b'], ['', 'string']]), 'a b'),
    },
    words: () => {
        assertEq(JSON.stringify(keyword('const')), '["const","keyword"]')
        assertEq(JSON.stringify(literal('null')), '["null","literal"]')
    },
    chunks: {
        text: () => {
            assertEq(chunkText('a'), 'a')
            assertEq(chunkText(['b', 'string']), 'b')
        },
        run: () => {
            assertEq(JSON.stringify(chunkRun('a')), '["a"]')
            assertEq(JSON.stringify(chunkRun(['b', 'string'])), '["b","string"]')
        },
        list: () => {
            assertEq(JSON.stringify(chunksMarked(['a', ['b', 'string']])), '[["a"],["b","string"]]')
            assertEq(chunksText(['a', ['b', 'string'], 'c']), 'abc')
            assertEq(JSON.stringify(toArray(chunkStrings(['a', ['b', 'string']]))), '["a","b"]')
        },
    },
    fromSpans: {
        noSpans: () => assertEq(JSON.stringify(unwrap(fromSpans('ab')([]))), '[["ab"]]'),
        empty: () => assertEq(JSON.stringify(unwrap(fromSpans('')([]))), '[]'),
        gaps: () => assertEq(
            JSON.stringify(unwrap(fromSpans('const a = 1')([
                { start: 0, length: 5, kind: 'keyword' },
                { start: 10, length: 1, kind: 'number' },
            ]))),
            '[["const","keyword"],[" a = "],["1","number"]]'),
        adjacentAndWhole: () => assertEq(
            JSON.stringify(unwrap(fromSpans('ab')([
                { start: 0, length: 1, kind: 'literal' },
                { start: 1, length: 1, kind: 'comment' },
            ]))),
            '[["a","literal"],["b","comment"]]'),
        codePoints: () => assertEq(
            JSON.stringify(unwrap(fromSpans('😀x')([{ start: 1, length: 1, kind: 'operator' }]))),
            '[["😀"],["x","operator"]]'),
        roundTrip: () => {
            const text = 'a 😀 b'
            assertEq(toText(unwrap(fromSpans(text)([{ start: 2, length: 1, kind: 'string' }]))), text)
        },
        refusals: () => {
            refused('abc')([{ start: 0, length: 0, kind: 'keyword' }])
            refused('abc')([{ start: -1, length: 1, kind: 'keyword' }])
            refused('abc')([{ start: 0.5, length: 1, kind: 'keyword' }])
            refused('abc')([{ start: 0, length: 1.5, kind: 'keyword' }])
            refused('abc')([{ start: 2, length: 2, kind: 'keyword' }])
            refused('abc')([{ start: 0, length: 2, kind: 'keyword' }, { start: 1, length: 1, kind: 'keyword' }])
            refused('abc')([{ start: 1, length: 1, kind: 'keyword' }, { start: 0, length: 1, kind: 'keyword' }])
            // the first refusal stands; later spans do not change it
            assertEq(refused('abc')([{ start: 5, length: 1, kind: 'keyword' }, { start: 0, length: 0, kind: 'keyword' }]),
                'span 5+1 is past the end of the text (3)')
        },
    },
}
