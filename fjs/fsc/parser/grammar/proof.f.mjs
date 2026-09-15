/**
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Meta } from '../../../ebnf/ast/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { Equal } from '../../../types/ts/types.ts'
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Items } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { parser } from '../../../ebnf/ll1/module.f.mjs'
import { repeatFrom0 } from '../../../ebnf/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { tokenize } from '../../tokenizer/module.f.mjs'
import {
    _ordinaryTokenNames as names, access, array, attribute, body, constStatement, djsModule,
    exportStatement, func, identifier, importStatement, index, items, key, member, object, primitive, sym, symbolOf, trivia,
    value,
} from './module.f.mjs'

// The value names itself, and the tree of a whole module is too deep a
// type for `tsc` to unroll through `parser`'s return type (TS2589); the
// rules are widened to `Rule` here, where only acceptance is read.
const parseModule = parser(/** @type {Rule} */ (djsModule))

/**
 * The parser's input for a text: its tokens, the final `eof` split off.
 *
 * @type {(s: string) => readonly Meta<DjsTokenWithMetadata>[]}
 */
const symbols = s => {
    const all = toArray(tokenize(stringToList(s))('a.js'))
    const last = all[all.length - 1]
    // a lexical failure is the stream's one token, an error and no `eof`
    return (last !== undefined && last.token.kind === 'eof' ? all.slice(0, -1) : all).map(symbolOf)
}

/**
 * What the grammar makes of a text: `ok`, or `error` at a token — named by
 * its kind, or by its word where it is an identifier, or `end` where the
 * input ran out.
 *
 * @type {(s: string) => readonly string[]}
 */
const read = s => {
    const input = symbols(s)
    const result = parseModule(input)
    if (result[0] === 'ok') { return ['ok'] }
    const at = input[result[1]]
    if (at === undefined) { return ['error', 'end'] }
    const { token } = at.meta
    return ['error', token.kind === 'id' ? token.value : token.kind]
}

export const proof = {
    // The grammar is LL(1): every rule builds, and so does the module.
    ll1: () => {
        parser(trivia)
        parser(identifier)
        parser(primitive)
        parser(key)
        parser(index)
        parser(access)
        parser(/** @type {Rule} */ (member))
        parser(/** @type {Rule} */ (value))
        parser(/** @type {Rule} */ (array))
        parser(/** @type {Rule} */ (object))
        parser(/** @type {Rule} */ (func))
        parser(/** @type {Rule} */ (body))
        parser(attribute)
        parser(/** @type {Rule} */ (importStatement))
        parser(/** @type {Rule} */ (constStatement))
        parser(/** @type {Rule} */ (exportStatement))
    },
    // One symbol per name, all distinct, all above every code point; a
    // framing keyword is not an identifier's symbol, and the token rides
    // along as metadata. `_AlphabetIsComplete` pins membership, but a
    // repeated name widens to the same union and is invisible to it, and
    // the encoding has to be injective over the list.
    alphabet: () => {
        assertEq(new Set(names).size, names.length)
        const all = names.map(sym)
        assertEq(new Set(all).size, names.length)
        assertEq(all.every(s => s > 0x10FFFF), true)
        const word = symbolOf({ token: { kind: 'id', value: 'export' }, metadata: { path: 'a.js', line: 1, column: 1 } })
        const id = symbolOf({ token: { kind: 'id', value: 'exports' }, metadata: { path: 'a.js', line: 1, column: 1 } })
        assertEq(word.symbol, sym('export'))
        assertEq(id.symbol, sym('id'))
        assertEq(id.meta.token.kind, 'id')
    },
    // A reserved literal has its own symbol, so where a rule wants an
    // identifier it is the token the grammar names in the error, not a word;
    // where a value may stand, it is one.
    reserved: () => {
        assertStructurallySame(read('const NaN = 1;\nexport default NaN;'), ['error', 'NaN'])
        assertStructurallySame(read('export default { Infinity: 1 };'), ['error', 'Infinity'])
        assertStructurallySame(read('export default [NaN, Infinity, -Infinity];'), ['ok'])
    },
    accepted: () => {
        assertStructurallySame(read('export default 1;'), ['ok'])
        assertStructurallySame(read(' /* c */ export default [1, [2,], {a: 1, "b": 2, ["c"]: 3,},] ; // c\n'), ['ok'])
        assertStructurallySame(read('import x from "m";\nconst a = [x];\nconst b = { a: a, };\nexport default [x, a, b];\n'), ['ok'])
        // a framing keyword is an identifier's symbol wherever a name may
        // stand, JavaScript's reserved ones included: which words are
        // reserved is the fold's to say, as for every other keyword
        assertStructurallySame(read('const export = 1;export default export;'), ['ok'])
        assertStructurallySame(read('const with = 1;export default { with: with.with };'), ['ok'])
        assertStructurallySame(read('const if = 1;export default if;'), ['ok'])
        // the import attribute: `with`, a key, a string, the braces
        assertStructurallySame(read('import x from "m" with { type: "json" };export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with{type:"json"};export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with { "type": "json" };export default x;'), ['error', 'string'])
        assertStructurallySame(read('import x from "m" with { type: json };export default x;'), ['error', 'json'])
        assertStructurallySame(read('import x from "m" with { type: "json", };export default x;'), ['error', ','])
        assertStructurallySame(read('import x from "m" with {};export default x;'), ['error', '}'])
        assertStructurallySame(read('export default\n1\n;'), ['ok'])
        assertStructurallySame(read('export default {};'), ['ok'])
        assertStructurallySame(read('export default [];'), ['ok'])
    },
    // A function: `(`, `...`, one parameter, `)`, `=>`, and a body that is
    // a value less the object — `=> {` opens a block in JavaScript — each
    // token followed by its trivia; no other parameter form yet
    func: () => {
        assertStructurallySame(read('export default (...a) => a;'), ['ok'])
        assertStructurallySame(read('export default ( ... a ) => /* c */ [ a , (...b) => 1 , ] ;'), ['ok'])
        assertStructurallySame(read('const f = (...a) => a.b[0]; export default { f: f };'), ['ok'])
        assertStructurallySame(read('export default (...a) => {};'), ['error', '{'])
        assertStructurallySame(read('export default () => 1;'), ['error', ')'])
        assertStructurallySame(read('export default (a) => 1;'), ['error', 'a'])
        assertStructurallySame(read('export default (...1) => 1;'), ['error', 'number'])
        assertStructurallySame(read('export default (...a, ...b) => 1;'), ['error', ','])
        assertStructurallySame(read('export default (...a) 1;'), ['error', 'number'])
        assertStructurallySame(read('export default (...a) => ;'), ['error', ';'])
        // no line terminator before `=>`, as JavaScript has it: a newline,
        // a line comment's newline, or a block comment holding one is
        // refused at the newline; a comment on the line is not, and the
        // body may start on the next line
        assertStructurallySame(read('export default (...a) /* c */ => 1;'), ['ok'])
        assertStructurallySame(read('export default (...a) =>\n1;'), ['ok'])
        assertStructurallySame(read('export default (...a)\n=> 1;'), ['error', 'nl'])
        assertStructurallySame(read('export default (...a) // c\n=> 1;'), ['error', 'nl'])
        assertStructurallySame(read('export default (...a) /* x\ny */ => 1;'), ['error', 'nl'])
    },
    // A reference takes accesses, `.name` and `[key]`, trivia allowed
    // around each token since a value ends with its own; a primitive or a
    // container takes none, and a key is a string or a number.
    access: () => {
        assertStructurallySame(read('const a = {}; export default a.b;'), ['ok'])
        assertStructurallySame(read('const a = {}; export default a["b"];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[0];'), ['ok'])
        assertStructurallySame(read('const a = {}; export default a . b [ "c" ] . default [ 1 ] ;'), ['ok'])
        assertStructurallySame(read('const a = {}; export default [a.b, { c: a.b.c, }];'), ['ok'])
        assertStructurallySame(read('export default 1 .x;'), ['error', '.'])
        assertStructurallySame(read('export default [1].x;'), ['error', '.'])
        assertStructurallySame(read('export default {}.x;'), ['error', '.'])
        assertStructurallySame(read('const a = []; export default a[1n];'), ['error', 'bigint'])
        assertStructurallySame(read('const a = []; export default a[b];'), ['error', 'b'])
        assertStructurallySame(read('const a = []; export default a[];'), ['error', ']'])
        assertStructurallySame(read('const a = {}; export default a.1;'), ['error', 'number'])
        assertStructurallySame(read('const a = {}; export default a.;'), ['error', ';'])
        assertStructurallySame(read('const a = {}; export default a."b";'), ['error', 'string'])
    },
    // `;` ends every statement: a newline does not, and neither does the
    // end of input. A newline is trivia, read past, so the failure is at
    // what came instead of the `;` — the next statement, or the end.
    terminator: () => {
        assertStructurallySame(read('export default 1'), ['error', 'end'])
        assertStructurallySame(read('export default 1\n'), ['error', 'end'])
        assertStructurallySame(read('const a = 1\nexport default a;'), ['error', 'export'])
        assertStructurallySame(read('import x from "m"\nconst a = x;\nexport default a;'), ['error', 'const'])
        assertStructurallySame(read('export default 1;;'), ['error', ';'])
    },
    refused: () => {
        assertStructurallySame(read(''), ['error', 'end'])
        assertStructurallySame(read('export default [1,,2];'), ['error', ','])
        assertStructurallySame(read('export default {,};'), ['error', ','])
        assertStructurallySame(read('export default [1 2];'), ['error', 'number'])
        assertStructurallySame(read('export default 1; const a = 2;'), ['error', 'const'])
        assertStructurallySame(read('const a = 1; import x from "m"; export default a;'), ['error', 'import'])
        assertStructurallySame(read('export default {1: 2};'), ['error', 'number'])
        assertStructurallySame(read('export default;'), ['error', ';'])
        assertStructurallySame(read('export default "abc;'), ['error', 'error'])
    },
    // `items` keeps the item's type: a tuple written at the call stays the
    // tuple, which is what its `const` type parameter is for — and the list
    // it builds is LL(1).
    itemsInference: () => {
        const list = items([42, 43])
        /** @typedef {Assert<Equal<typeof list, Items<readonly [42, 43]>>>} _ItemsKeepTheTuple */
        parser(list)
    },
    // Statements end with `;`, so a repetition of any statement is LL(1)
    // too — the order is the module's rule, not lookahead's.
    statements: () => {
        parser(/** @type {Rule} */ (repeatFrom0({ importStatement, constStatement, exportStatement })))
    },
    throw: {
        eofRejected: () => symbolOf({ token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 1 } }),
    },
}
