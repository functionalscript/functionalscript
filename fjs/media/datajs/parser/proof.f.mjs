/**
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Equal } from '../../../types/ts/types.ts'
 * @import { Ast, Meta } from '../../../ebnf/ast/types.ts'
 * @import { Parser } from '../../../ebnf/ll1/types.ts'
 * @import { Utf16 } from '../../../ebnf/utf16/types.ts'
 * @import { Unknown } from '../types.ts'
 * @import { Node, Out, Value } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { parser } from '../../../ebnf/ll1/module.f.mjs'
import { units } from '../../../ebnf/utf16/module.f.mjs'
import { value } from '../../../ebnf/lib/datajs/module.f.mjs'
import { mappings, parse } from './module.f.mjs'

const { is, keys, hasOwn, getPrototypeOf } = Object

/** The value a document spells, where it spells one. @type {(text: string) => Unknown} */
const parsed = text => unwrap(parse(text))

/** The value `export default` of a text is. @type {(text: string) => Unknown} */
const exported = text => parsed(`export default ${text};`)

/** @type {(text: string) => Result<Unknown, string>} */
const exporting = text => parse(`export default ${text};`)

/** A document that is no DataJS, by the message it is refused with. @type {(text: string, message: string) => void} */
const refused = (text, message) => assertStructurallySame(parse(text), ['error', message])

/** @type {(value: Unknown) => readonly Unknown[]} */
const asArray = value => {
    assert(value instanceof Array)
    return value
}

/** @type {(value: Unknown) => object} */
const asObject = value => {
    assert(typeof value === 'object' && value !== null && !(value instanceof Array))
    return value
}

/** @type {(node: Node) => Meta<Value>} */
const valueSymbol = node => ({ symbol: 0, meta: { id: 'value', node } })

/**
 * The value rule alone, with the set folded: it stops where the rule does,
 * and its node is the one symbol the `value` mapping returned.
 */
const parseValue = parser(value, mappings)

export const proof = {
    // Each of the leaves, alone in a document: JSON's, and the ones the
    // format adds — `undefined`, `NaN` and the infinities as words, a bigint
    // with the `n` suffix.
    leaves: () => {
        assertEq(exported('null'), null)
        assertEq(exported('true'), true)
        assertEq(exported('false'), false)
        assertEq(exported('undefined'), undefined)
        assert(is(exported('NaN'), NaN))
        assertEq(exported('Infinity'), Infinity)
        assertEq(exported('-Infinity'), -Infinity)
        assertEq(exported('"x"'), 'x')
        assertEq(exported('42'), 42)
        assertEq(exported('42n'), 42n)
        assertStructurallySame(exported('[]'), [])
        assertStructurallySame(exported('{}'), {})
    },
    // A number is a JSON number read as JavaScript reads it: every form the
    // grammar admits, `-0` kept as `-0` on each of its three lexical routes,
    // and a value the finite range cannot hold read as the infinity, since
    // the number denotes a binary64 value and not the literal.
    numbers: () => {
        assertEq(exported('0'), 0)
        assertEq(exported('-9'), -9)
        assertEq(exported('109'), 109)
        assertEq(exported('-1.09'), -1.09)
        assertEq(exported('1e09'), 1e9)
        assertEq(exported('1E2'), 100)
        assertEq(exported('-1e+2'), -100)
        assertEq(exported('1.09e-2'), 0.0109)
        assert(is(exported('-0'), -0))
        assert(is(exported('-0.0'), -0))
        assert(is(exported('-0e0'), -0))
        assert(is(exported('0.0'), 0))
        assert(is(exported('-1e-999'), -0))
        assertEq(exported('1000000000000000128'), 1000000000000000100)
        assertEq(exported('5e-324'), 5e-324)
        assertEq(exported('1e999'), Infinity)
        assertEq(exported('-1e999'), -Infinity)
        assertEq(exported('1.7976931348623157e308'), 1.7976931348623157e308)
    },
    // A bigint is its own production, `'-'? int 'n'`: read from its digits
    // whole, however many, and `-0n` is `0n`, since bigint has no negative
    // zero.
    bigints: () => {
        assertEq(exported('0n'), 0n)
        assertEq(exported('-0n'), 0n)
        assert(!is(exported('-0n'), -0))
        assertEq(exported('9n'), 9n)
        assertEq(exported('-34n'), -34n)
        assertEq(exported('123456789012345678901234567890n'), 123456789012345678901234567890n)
        assertEq(exported('-123456789012345678901234567890n'), -123456789012345678901234567890n)
    },
    // A string is JSON's, unchanged: its escapes decoded, and the alphabet
    // code units, so a lone surrogate is one unit in and one out, raw or
    // escaped.
    strings: () => {
        assertEq(exported('""'), '')
        assertEq(exported('"\\" \\\\ \\/ \\b \\f \\n \\r \\t"'), '" \\ / \b \f \n \r \t')
        assertEq(exported('"\\u0041\\u00e9\\u00E9\\u4e2d"'), 'Aéé中')
        assertEq(exported('"😀"'), '😀')
        assertEq(exported('"\\ud83d\\ude00"'), '😀')
        assertEq(exported('"\ud800"'), '\ud800')
        assertEq(exported('"\\udc00"'), '\udc00')
        // every character JavaScript calls whitespace that JSON admits raw
        // is an ordinary character inside a string
        assertEq(exported('"\u00a0 \u2028\u2029\ufeff"'), '\u00a0 \u2028\u2029\ufeff')
        assertEq(exported('"\\f\\u000b"'), '\f\v')
    },
    // Containers hold values, whitespace stands wherever the grammar allows
    // it, and a member whose value is `undefined` is present.
    containers: () => {
        assertStructurallySame(exported('[1, [2n, [3]], {"a": [null]}]'), [1, [2n, [3]], { a: [null] }])
        assertStructurallySame(exported(' \n\r\t[ 1 ,\t2 ] '), [1, 2])
        assertStructurallySame(exported('{ "a" : 1 , "b" : { } }'), { a: 1, b: {} })
        assertStructurallySame(exported('{"":0}'), { '': 0 })
        const present = asObject(exported('{"a":undefined}'))
        assert(hasOwn(present, 'a'))
        assertEq(keys(present).length, 1)
        assertEq(keys(asObject(exported('{}'))).length, 0)
    },
    // An object's members are its own properties in JavaScript's order:
    // array-index keys first by numeric value, then the rest as written; a
    // duplicate keeps its first position and takes its last value.
    keyOrder: () => {
        assertStructurallySame(keys(asObject(exported('{"b":1,"a":2}'))), ['b', 'a'])
        const duplicate = asObject(exported('{"a":1,"b":2,"a":3}'))
        assertStructurallySame(keys(duplicate), ['a', 'b'])
        assertStructurallySame(duplicate, { a: 3, b: 2 })
        assertStructurallySame(keys(asObject(exported('{"z":0,"2":0,"1":0,"y":0}'))), ['1', '2', 'z', 'y'])
        assertStructurallySame(keys(asObject(exported('{"10":0,"9":0}'))), ['9', '10'])
        // not an array index: a sign, a leading zero, a fraction, `2^32 - 1`
        assertStructurallySame(keys(asObject(exported('{"-1":0,"01":0,"1.0":0,"4294967295":0,"4294967294":0}'))), ['4294967294', '-1', '01', '1.0', '4294967295'])
    },
    // `__proto__` has one spelling, the computed one, which denotes an own
    // property and leaves the prototype alone; every plain string spelling
    // of it is refused on its decoded value.
    proto: () => {
        const computed = asObject(exported('{["__proto__"]:1}'))
        assert(hasOwn(computed, '__proto__'))
        assertStructurallySame(keys(computed), ['__proto__'])
        assertEq(getPrototypeOf(computed), Object.prototype)
        assertStructurallySame(exported('{["__proto__"]:1,"a":2}'), JSON.parse('{"__proto__":1,"a":2}'))
        const message = /** @type {const} */ ('a "__proto__" key is spelled ["__proto__"]')
        refused('export default {"__proto__":1};', message)
        refused('export default {"\\u005f_proto__":1};', message)
        refused('export default {"__proto\\u005f_":1};', message)
        refused('export default [{"a":{"__proto__":[]}}];', message)
        // the computed form is one token: no whitespace, no escape
        refused('export default {[ "__proto__" ]:1};', 'unexpected symbol at 17')
        refused('export default {["\\u005f_proto__"]:1};', 'unexpected symbol at 18')
    },
    // A `const` names a node, and a reference denotes that node: one array in
    // two slots is one array, where two arrays written out are two.
    sharing: () => {
        const shared = asArray(parsed('const $0=[];export default [$0,$0];'))
        assert(is(shared[0], shared[1]))
        const distinct = asArray(parsed('export default [[],[]];'))
        assert(!is(distinct[0], distinct[1]))
        const nested = parsed('const $0={};const $1=[$0];export default {"a":$1,"b":$0,"c":$1};')
        assert(typeof nested === 'object' && nested !== null && !(nested instanceof Array))
        assert(is(asArray(nested.a)[0], nested.b))
        assert(is(nested.a, nested.c))
        assertStructurallySame(nested, { a: [{}], b: {}, c: [{}] })
        // a name binds any value, `null` and `undefined` included, may be
        // referenced any number of times, and may be `$` alone
        assertStructurallySame(parsed('const $=null;const $$=undefined;const $a_0=1;export default [$,$$,$a_0,$a_0];'), [null, undefined, 1, 1])
        assertEq(parsed('const $unused=[];export default 1;'), 1)
        assertEq(parsed('const $x = 1 ; export default $x ;'), 1)
    },
    // After recognition, three rules: a reference names a `const` declared
    // before it — so a name is not in scope in its own value — and a name is
    // bound at most once. The first broken in document order is the
    // document's error, whichever rule it breaks.
    resolution: () => {
        refused('export default $x;', 'unresolved reference $x')
        refused('const $0=$0;export default 0;', 'unresolved reference $0')
        refused('const $0=$1;const $1=1;export default 0;', 'unresolved reference $1')
        refused('const $0=1;const $0=2;export default 1;', 'duplicate const $0')
        refused('const $0=1;const $0=$x;export default 1;', 'duplicate const $0')
        refused('export default [{"__proto__":1},$x];', 'a "__proto__" key is spelled ["__proto__"]')
        refused('export default [$x,{"__proto__":1}];', 'unresolved reference $x')
        refused('export default {"a":[$x],"b":[$y]};', 'unresolved reference $x')
        refused('const $0=[$x];export default {"__proto__":1};', 'unresolved reference $x')
    },
    // Whitespace is JSON's four characters, insignificant between tokens and
    // required after `const`, `export` and `default`; every other character
    // JavaScript calls whitespace is refused outside a string.
    whitespace: () => {
        assertStructurallySame(parsed(' \n\r\tconst \n\r\t$0 \n\r\t= \n\r\t1 \n\r\t; \n\r\texport \n\r\tdefault \n\r\t[ \n\r\t$0 \n\r\t, \n\r\t2 \n\r\t] \n\r\t; \n\r\t'), [1, 2])
        assertEq(parsed('export default 1;\n'), 1)
        assertEq(parsed('export default 1;  \n'), 1)
        refused('const$0=1;export default $0;', 'unexpected symbol at 5')
        refused('exportdefault 1;', 'unexpected symbol at 6')
        refused('export default1;', 'unexpected symbol at 14')
        refused('export default[1];', 'unexpected symbol at 14')
        refused('export default$0;', 'unexpected symbol at 14')
        refused('\ufeffexport default 1;', 'unexpected symbol at 0')
        refused('export\u00a0default 1;', 'unexpected symbol at 6')
        refused('export default\u2028 1;', 'unexpected symbol at 14')
        refused('export default 1\u2029;', 'unexpected symbol at 16')
        refused('export default 1;\f', 'unexpected symbol at 17')
        refused('export default 1;\v', 'unexpected symbol at 17')
    },
    // A document is `const` statements then one `export default`, every
    // statement ending with `;`, and nothing else: no empty statement, no
    // second export, nothing after the last `;`, no `import`, no comment.
    statements: () => {
        refused('', 'unexpected end')
        refused('   ', 'unexpected end')
        refused('const $0=1;', 'unexpected end')
        refused('export default 1', 'unexpected end')
        refused('export default', 'unexpected end')
        refused('export', 'unexpected end')
        refused('const $0', 'unexpected end')
        refused('const $0=1', 'unexpected end')
        refused('1;', 'unexpected symbol at 0')
        refused(';export default 1;', 'unexpected symbol at 0')
        refused('export default 1;;', 'unexpected symbol at 17')
        refused('const $0=1;;export default 1;', 'unexpected symbol at 11')
        refused('export default 1;garbage', 'unexpected symbol at 17')
        refused('export default 1; export default 2;', 'unexpected symbol at 18')
        refused('export default 1;const $0=1;', 'unexpected symbol at 17')
        refused('import $0 from "a";export default $0;', 'unexpected symbol at 0')
        refused('// a\nexport default 1;', 'unexpected symbol at 0')
        refused('export default 1;// a', 'unexpected symbol at 17')
        refused('export default /* a */ 1;', 'unexpected symbol at 15')
        refused('const a=1;export default a;', 'unexpected symbol at 6')
        refused('const $é=1;export default 1;', 'unexpected symbol at 7')
        refused('let $0=1;export default $0;', 'unexpected symbol at 0')
        refused('export default $0', 'unexpected end')
    },
    // A value is one of the grammar's alternatives and nothing JavaScript
    // would also read: no trailing comma, no identifier key, no single
    // quotes, no hexadecimal, no `+`, no bare `.`, no `-` before anything
    // but a number, a bigint or `Infinity`, and no `n` after a fraction or
    // an exponent.
    values: () => {
        refused('export default [1,];', 'unexpected symbol at 18')
        refused('export default {"a":1,};', 'unexpected symbol at 22')
        refused('export default [,];', 'unexpected symbol at 16')
        refused('export default {a:1};', 'unexpected symbol at 16')
        refused('export default {1:1};', 'unexpected symbol at 16')
        refused("export default 'a';", 'unexpected symbol at 15')
        refused('export default `a`;', 'unexpected symbol at 15')
        refused('export default "\\x41";', 'unexpected symbol at 17')
        refused('export default "\\u{41}";', 'unexpected symbol at 18')
        refused('export default "a\nb";', 'unexpected symbol at 17')
        refused('export default 0x1;', 'unexpected symbol at 16')
        refused('export default +1;', 'unexpected symbol at 15')
        refused('export default .5;', 'unexpected symbol at 15')
        refused('export default 1.;', 'unexpected symbol at 17')
        refused('export default 01;', 'unexpected symbol at 16')
        refused('export default 1_0;', 'unexpected symbol at 16')
        refused('export default 1.5n;', 'unexpected symbol at 18')
        refused('export default 1e2n;', 'unexpected symbol at 18')
        refused('export default 01n;', 'unexpected symbol at 16')
        refused('export default -;', 'unexpected symbol at 16')
        refused('export default - 1;', 'unexpected symbol at 16')
        refused('export default -NaN;', 'unexpected symbol at 16')
        refused('export default -undefined;', 'unexpected symbol at 16')
        refused('export default -true;', 'unexpected symbol at 16')
        refused('export default -"a";', 'unexpected symbol at 16')
        refused('export default -$0;', 'unexpected symbol at 16')
        refused('export default nan;', 'unexpected symbol at 16')
        refused('export default infinity;', 'unexpected symbol at 15')
        refused('export default Undefined;', 'unexpected symbol at 15')
        refused('export default tru;', 'unexpected symbol at 18')
        refused('export default [1 2];', 'unexpected symbol at 18')
        refused('export default {"a" 1};', 'unexpected symbol at 20')
        refused('export default [}', 'unexpected symbol at 16')
        refused('export default "abc', 'unexpected end')
        refused('export default \ud800;', 'unexpected symbol at 15')
    },
    // Nesting depth grows with the input, and neither the fold nor the
    // resolution adds depth to the machine's: 5000 levels of brackets parse
    // whole with a reference at the bottom as well as a leaf, and so do 6000
    // consts each naming the one before, 6000 sibling containers and an
    // array of 12000 items.
    deep: () => {
        const n = /** @type {const} */ (5000)
        /** @type {(depth: number, v: Unknown) => number} */
        const depthOf = (depth, v) => v instanceof Array && v.length === 1 ? depthOf(depth + 1, v[0]) : depth
        assertEq(depthOf(0, exported('['.repeat(n) + ']'.repeat(n))), n - 1)
        const bottom = parsed(`const $0=[];export default ${'['.repeat(n)}$0${']'.repeat(n)};`)
        assertEq(depthOf(0, bottom), n)
        const s = /** @type {const} */ (6000)
        const chain = parsed(Array.from({ length: s }, (_, i) => `const $${i}=[${i === 0 ? '' : `$${i - 1}`}];`).join('') + `export default $${s - 1};`)
        assertEq(depthOf(0, chain), s - 1)
        assertEq(asArray(exported(`[${Array(s).fill('{}').join(',')}]`)).length, s)
        assertEq(keys(asObject(exported(`{${Array.from({ length: s }, (_, i) => `"k${i}":[]`).join(',')}}`))).length, s)
        const m = /** @type {const} */ (12000)
        const wide = asArray(exported(`[${Array.from({ length: m }, (_, i) => i).join(',')}]`))
        assertEq(wide.length, m)
        assertEq(wide[m - 1], m - 1)
    },
    // The set folded into the grammar's own value rule: its node is the one
    // symbol the `value` mapping returned, a reference and a refusal among
    // its nodes as they are before resolution, and the rule stops where it
    // does. The parser is typed by the two alphabets, read off the set.
    mappings: () => {
        /** @typedef {Assert<Equal<typeof parseValue, Parser<Ast<typeof value, Utf16, Out>, Utf16>>>} _Typed */
        assertStructurallySame(parseValue(units('[1]x')), ['ok', [valueSymbol(['array', [1]]), 3]])
        assertStructurallySame(parseValue(units('$0')), ['ok', [valueSymbol(['ref', '$0']), 2]])
        assertStructurallySame(
            parseValue(units('{"a":$0,["__proto__"]:1n,"__proto__":2}')),
            ['ok', [valueSymbol(['object', [
                ['a', ['ref', '$0']],
                ['__proto__', 1n],
                ['__proto__', ['error', 'a "__proto__" key is spelled ["__proto__"]']],
            ]]), 39]])
    },
    // `parse` is total over strings: what it returns is a value or a
    // message, and nothing it is given makes it throw.
    contract: () => {
        /** @typedef {Assert<Equal<typeof parse, (text: string) => Result<Unknown, string>>>} _Parse */
        assertEq(exporting('[')[0], 'error')
        assertEq(exporting('1')[0], 'ok')
    },
}
