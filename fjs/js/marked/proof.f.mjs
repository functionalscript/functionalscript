import { disagreement, spansOf, tsSpansOf } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.js'

export const proof = {
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
    spans: () => assertEq(JSON.stringify(spansOf('a /* x */ 1')),
        '[{"start":0,"length":1,"kind":"identifier"},{"start":2,"length":7,"kind":"comment"},{"start":10,"length":1,"kind":"number"}]'),
    // A text the tokenizer refuses has no spans, not the ones before the failure.
    refused: () => assertEq(spansOf('1 @ 2').length, 0),
    disagreement: () => {
        assertEq(disagreement([['const', 'keyword'], [' '], ['a', 'identifier'], [' = '], ['-1', 'number'], [';']]), null)
        // a name the producer left plain, and a word it marked as another kind
        assertEq(disagreement([['const', 'keyword'], [' a']]), 'marked [{"start":0,"length":5,"kind":"keyword"}], the tokenizer finds [{"start":0,"length":5,"kind":"keyword"},{"start":6,"length":1,"kind":"identifier"}], in const a')
        assertEq(disagreement([['x', 'keyword']]), 'marked [{"start":0,"length":1,"kind":"keyword"}], the tokenizer finds [{"start":0,"length":1,"kind":"identifier"}], in x')
    },
    // TypeScript's own words are keywords where an operand follows them on
    // their line, and names everywhere else.
    typeScript: () => {
        /** @type {(text: string) => string} */
        const keywords = text => JSON.stringify(tsSpansOf(text).flatMap(({ start, length, kind }) =>
            kind === 'keyword' ? [Array.from(text).slice(start, start + length).join('')] : []))
        // an operand follows: a name, a keyword, a string, `{`, and `[` after `readonly`
        assertEq(keywords('export type A = readonly B[]'), '["export","type","readonly"]')
        assertEq(keywords('x as const; declare module "m"; import type { A }'), '["as","const","declare","module","import","type"]')
        assertEq(keywords('type A = readonly [unique symbol]'), '["type","readonly","unique"]')
        // a variable: an operator or the line's end follows, or it is a
        // property; the `as` casting one is a keyword still
        assertEq(keywords('const type = out; f(type, readonly)'), '["const"]')
        assertEq(keywords('type\nA; type /* c */ in x; out of xs; type as T; type [0]'), '["in","as"]')
        assertEq(keywords('x.type A'), '[]')
        // a primitive type name is a name, as no neighbour says it is a type
        assertEq(keywords('let a: string'), '["let"]')
        // JavaScript reads them all as names
        assertEq(JSON.stringify(spansOf('type A').map(({ kind }) => kind)), '["identifier","identifier"]')
    },
}
