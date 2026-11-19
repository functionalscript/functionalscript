import { chunkRun, chunkStrings, fromTagged, keyword, literal, tagged, textOfResult, toTagged, untagged, withNames, chunkText, chunksMarked, chunksText, fromSpans, toText } from './module.f.js'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { error, ok, unwrap } from '../../types/result/module.f.js'
import { toJson } from '../../media/json/module.f.js'

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
            assertStructurallySame(unwrap(fromTagged(text)), [['let x = '], ['0x1', 'number'], [', '], ['"a"', 'string'], [';'], ['// c', 'comment']])
            assertEq(untagged(text), 'let x = 0x1, "a";// c')
        },
        plain: () => {
            assertStructurallySame(unwrap(fromTagged('')), [])
            assertStructurallySame(unwrap(fromTagged('a b')), [['a b']])
            assertStructurallySame(unwrap(fromTagged(tagged('keyword')('let'))), [['let', 'keyword']])
            assertStructurallySame(unwrap(fromTagged(`${tagged('keyword')('a')}${tagged('literal')('b')}`)), [['a', 'keyword'], ['b', 'literal']])
        },
        // Runs written as tagged text read back as the same runs.
        toTagged: () => {
            /** @type {import('./types.ts').Marked} */
            const marked = [['let', 'keyword'], [' x = '], ['1', 'number'], [';']]
            assertEq(toTagged(marked), `${tagged('keyword')('let')} x = ${tagged('number')('1')};`)
            assertStructurallySame(unwrap(fromTagged(toTagged(marked))), marked)
        },
        // A marker in a plain run would read back as a tag, so it is refused.
        toTaggedRefusesAMarker: {
            throw: {
                open: () => toTagged([['\u0001kx']]),
                close: () => toTagged([['x\u0002']]),
            },
        },
        everyKind: () => {
            for (const kind of /** @type {const} */ (['keyword', 'literal', 'string', 'number', 'comment', 'operator', 'identifier'])) {
                assertStructurallySame(unwrap(fromTagged(tagged(kind)('x'))), [['x', kind]])
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
    withNames: () => {
        assertStructurallySame(withNames([]), [])
        assertStructurallySame(withNames([['']]), [])
        // a word is a name; what lies between stays plain
        assertStructurallySame(withNames([['a.b + $0(_x1, y)']]), [['a', 'identifier'], ['.'], ['b', 'identifier'], [' + '], ['$0', 'identifier'], ['('], ['_x1', 'identifier'], [', '], ['y', 'identifier'], [')']])
        // a run that has a kind is left alone, and a word starting with a digit is not a name
        assertStructurallySame(withNames([['let', 'keyword'], [' 0x1f x'], ['y', 'string']]), [['let', 'keyword'], [' 0x1f '], ['x', 'identifier'], ['y', 'string']])
        // no letters, no names
        assertStructurallySame(withNames([['(){};, ']]), [['(){};, ']])
    },
    words: () => {
        assertStructurallySame(keyword('const'), ['const', 'keyword'])
        assertStructurallySame(literal('null'), ['null', 'literal'])
    },
    chunks: {
        text: () => {
            assertEq(chunkText('a'), 'a')
            assertEq(chunkText(['b', 'string']), 'b')
        },
        run: () => {
            assertStructurallySame(chunkRun('a'), ['a'])
            assertStructurallySame(chunkRun(['b', 'string']), ['b', 'string'])
        },
        list: () => {
            assertStructurallySame(chunksMarked(['a', ['b', 'string']]), [['a'], ['b', 'string']])
            assertEq(chunksText(['a', ['b', 'string'], 'c']), 'abc')
            assertEq(toJson(toArray(chunkStrings(['a', ['b', 'string']]))), '["a","b"]')
        },
    },
    fromSpans: {
        noSpans: () => assertStructurallySame(unwrap(fromSpans('ab')([])), [['ab']]),
        empty: () => assertStructurallySame(unwrap(fromSpans('')([])), []),
        gaps: () => assertStructurallySame(
            unwrap(fromSpans('const a = 1')([
                { start: 0, length: 5, kind: 'keyword' },
                { start: 10, length: 1, kind: 'number' },
            ])),
            [['const', 'keyword'], [' a = '], ['1', 'number']]),
        adjacentAndWhole: () => assertStructurallySame(
            unwrap(fromSpans('ab')([
                { start: 0, length: 1, kind: 'literal' },
                { start: 1, length: 1, kind: 'comment' },
            ])),
            [['a', 'literal'], ['b', 'comment']]),
        codePoints: () => assertStructurallySame(
            unwrap(fromSpans('😀x')([{ start: 1, length: 1, kind: 'operator' }])),
            [['😀'], ['x', 'operator']]),
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
