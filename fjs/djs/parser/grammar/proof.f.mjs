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
    _ordinaryTokenNames as names, array, constStatement, djsModule,
    exportStatement, identifier, importStatement, items, key, member, object, primitive, sym, symbolOf, trivia,
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
        parser(/** @type {Rule} */ (member))
        parser(/** @type {Rule} */ (value))
        parser(/** @type {Rule} */ (array))
        parser(/** @type {Rule} */ (object))
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
    accepted: () => {
        assertStructurallySame(read('export default 1;'), ['ok'])
        assertStructurallySame(read(' /* c */ export default [1, [2,], {a: 1, "b": 2, ["c"]: 3,},] ; // c\n'), ['ok'])
        assertStructurallySame(read('import x from "m";\nconst a = [x];\nconst b = { a: a, };\nexport default [x, a, b];\n'), ['ok'])
        assertStructurallySame(read('const export = 1;export default export;'), ['ok'])
        assertStructurallySame(read('export default\n1\n;'), ['ok'])
        assertStructurallySame(read('export default {};'), ['ok'])
        assertStructurallySame(read('export default [];'), ['ok'])
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
