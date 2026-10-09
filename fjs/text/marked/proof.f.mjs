import { chunkRun, chunkStrings, fromTagged, keyword, literal, tagged, textOfResult, untagged, chunkText, chunksMarked, chunksText, fromSpans, toText } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'

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
    textOfResult: () => {
        assertEq(textOfResult(ok([['a', 'keyword'], [' b']])), 'a b')
        assertEq(textOfResult(error('refused')), 'refused')
    },
    tagged: {
        roundTrip: () => {
            const text = `let x = ${tagged('number')('0x1')}, ${tagged('string')('"a"')};${tagged('comment')('// c')}`
            assertEq(JSON.stringify(unwrap(fromTagged(text))), '[["let x = "],["0x1","number"],[", "],["\\"a\\"","string"],[";"],["// c","comment"]]')
            assertEq(untagged(text), 'let x = 0x1, "a";// c')
        },
        plain: () => {
            assertEq(JSON.stringify(unwrap(fromTagged(''))), '[]')
            assertEq(JSON.stringify(unwrap(fromTagged('a b'))), '[["a b"]]')
            assertEq(JSON.stringify(unwrap(fromTagged(tagged('keyword')('let')))), '[["let","keyword"]]')
            assertEq(JSON.stringify(unwrap(fromTagged(`${tagged('keyword')('a')}${tagged('literal')('b')}`))), '[["a","keyword"],["b","literal"]]')
        },
        everyKind: () => {
            for (const kind of /** @type {const} */ (['keyword', 'literal', 'string', 'number', 'comment', 'operator'])) {
                assertEq(JSON.stringify(unwrap(fromTagged(tagged(kind)('x')))), `[["x","${kind}"]]`)
            }
        },
        refused: () => {
            assertEq(fromTagged('a\u0001kx')[1], 'a tag left open')
            assertEq(fromTagged('\u0001zx\u0002')[1], 'a tag of no kind: z')
            assertEq(fromTagged('\u0001')[1], 'a tag of no kind: ')
            assertEq(fromTagged('x\u0002')[1], 'a closing marker with no opening')
            assertEq(fromTagged('\u0001kx\u0002y\u0002')[1], 'a closing marker with no opening')
            // an error stands, and later parts do not change it
            assertEq(fromTagged('\u0001zx\u0002\u0001ky\u0002')[1], 'a tag of no kind: z')
        },
    },
    throw: {
        forged: () => tagged('string')('a\u0001b'),
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
