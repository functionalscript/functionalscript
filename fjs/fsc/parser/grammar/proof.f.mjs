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
    _ordinaryTokenNames as names, access, array, attribute, block, body, constStatement, djsModule,
    exportStatement, func, group, identifier, importStatement, index, items, key, member, object, parameters, paren, parenGroup,
    parenthesized, primitive, sym, symbolOf, trivia, value,
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
        parser(parameters)
        parser(/** @type {Rule} */ (func))
        parser(/** @type {Rule} */ (group))
        parser(/** @type {Rule} */ (parenthesized))
        parser(/** @type {Rule} */ (paren))
        parser(/** @type {Rule} */ (parenGroup))
        parser(/** @type {Rule} */ (body))
        parser(/** @type {Rule} */ (block))
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
    // A word that denotes a value has its own symbol, and where a *name*
    // may stand — a property's, a binding's — it is one of those symbols
    // the identifier rule admits, exactly as a framing keyword is. So the
    // grammar takes `{ Infinity: 1 }` and `const NaN = 1;` alike, and which
    // of them may be *bound* is the fold's to say, as for every other
    // keyword. Where a value may stand, the word is the value.
    //
    // `-Infinity` is no longer a word: it is the prefix and `Infinity`, so
    // where a value may stand it is a negation, and where a key may stand
    // the `-` is what the grammar answers at.
    reserved: () => {
        assertStructurallySame(read('const NaN = 1;\nexport default NaN;'), ['ok'])
        assertStructurallySame(read('export default { Infinity: 1 };'), ['ok'])
        assertStructurallySame(read('const a = { NaN: 1 };export default a.NaN;'), ['ok'])
        assertStructurallySame(read('export default [NaN, Infinity, -Infinity];'), ['ok'])
        assertStructurallySame(read('export default { -Infinity: 1 };'), ['error', '-'])
    },
    namedExports: () => {
        for (const source of [
            'export const a=1;',
            'const b=1; export const a=b; const c=a; export const z=c; export default z;',
            'export const a=1; const b=a;',
        ]) { assertStructurallySame(read(source), ['ok']) }
        assertStructurallySame(read('export const a=1; export default 2; const b=3;'), ['error', 'const'])
        assertStructurallySame(read('export const a=1; import b from "./b";'), ['error', 'import'])
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
        assertStructurallySame(read('const return = 1;export default { return: return.return };'), ['ok'])
        // the import attribute: `with`, a key, a string, the braces
        assertStructurallySame(read('import x from "m" with { type: "json" };export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with{type:"json"};export default x;'), ['ok'])
        // the key is a name, so a word with a symbol of its own stands here
        // as any other word does and the fold names it unknown
        assertStructurallySame(read('import x from "m" with { return: "json" };export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with { export: "json" };export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with { NaN: "json" };export default x;'), ['ok'])
        assertStructurallySame(read('import x from "m" with { "type": "json" };export default x;'), ['error', 'string'])
        assertStructurallySame(read('import x from "m" with { type: json };export default x;'), ['error', 'json'])
        assertStructurallySame(read('import x from "m" with { type: "json", };export default x;'), ['error', ','])
        assertStructurallySame(read('import x from "m" with {};export default x;'), ['error', '}'])
        assertStructurallySame(read('export default\n1\n;'), ['ok'])
        assertStructurallySame(read('export default {};'), ['ok'])
        assertStructurallySame(read('export default [];'), ['ok'])
    },
    // A function: `(`, the parameter list, `)`, `=>`, and a body that is
    // a value less the object — `=> {` opens a block, which `block` below
    // covers — each token followed by its trivia. The list is the one rest
    // parameter or nothing; no named form yet
    func: () => {
        assertStructurallySame(read('export default (...a) => a;'), ['ok'])
        assertStructurallySame(read('export default ( ... a ) => /* c */ [ a , (...b) => 1 , ] ;'), ['ok'])
        assertStructurallySame(read('const f = (...a) => a.b[0]; export default { f: f };'), ['ok'])
        // the empty list, and the trivia inside it: the one symbol after
        // the `(` decides all three ways — `...` opens the parameter, `)`
        // closes an empty list, and everything a value may start with is a
        // group's
        assertStructurallySame(read('export default () => 1;'), ['ok'])
        assertStructurallySame(read('export default ( /* c */ ) => 1;'), ['ok'])
        assertStructurallySame(read('export default (\n) => 1;'), ['ok'])
        assertStructurallySame(read('export default () => () => 1;'), ['ok'])
        assertStructurallySame(read('export default () => { return 1; };'), ['ok'])
        assertStructurallySame(read('const f = () => 1; export default f();'), ['ok'])
        // `(a)` is a group of a reference, so the failure is not at the
        // name but at the `=>`, which cannot follow a value: parenthesized
        // parameters wait on named parameters
        // (`spec/todo/3120-parameters.md`), which JavaScript itself tells
        // from a group only past the `)`
        assertStructurallySame(read('export default (a) => 1;'), ['error', '=>'])
        assertStructurallySame(read('export default (...1) => 1;'), ['error', 'number'])
        assertStructurallySame(read('export default (...a, ...b) => 1;'), ['error', ','])
        assertStructurallySame(read('export default (,) => 1;'), ['error', ','])
        assertStructurallySame(read('export default () 1;'), ['error', 'number'])
        assertStructurallySame(read('export default () => ;'), ['error', ';'])
        assertStructurallySame(read('export default ()\n=> 1;'), ['error', 'nl'])
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
        // the Unicode line and paragraph separators are no token outside a
        // string, so neither stands here, in a comment or bare
        assertStructurallySame(read('export default (...a) /* x\u2028y */ => 1;'), ['error', 'error'])
        assertStructurallySame(read('export default (...a) /* x\u2029y */ => 1;'), ['error', 'error'])
        assertStructurallySame(read('export default (...a)\u2028=> 1;'), ['error', 'error'])
        assertStructurallySame(read('export default (...a)\u2029=> 1;'), ['error', 'error'])
    },
    // A block body: `{ const* return value; }` — any number of `const`
    // statements and then the one `return`. The value is an ordinary value,
    // the object included, since `{` opens a block only where a statement
    // may start and after `return` an expression is expected.
    block: () => {
        assertStructurallySame(read('export default (...a) => { return a; };'), ['ok'])
        assertStructurallySame(read('export default (...a)=>{return a;};'), ['ok'])
        assertStructurallySame(read('export default (...a) =>\n{\n    return a;\n};'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return { x: 1 }; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return (...b) => { return b; }; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return a.b[0]; };'), ['ok'])
        // the body's `const` statements, the module's own rule: any number
        // of them, each ended by its `;`, and all of them before the one
        // `return` — which is where a body's names come from, the grammar
        // saying nothing about which scope binds one
        assertStructurallySame(read('export default (...a) => { const x = 1; return x; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { const x = 1; const y = 2; return [x, y]; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => {const x=1;return x;};'), ['ok'])
        assertStructurallySame(read('export default (...a) => {\n    const x = 1;\n    return x;\n};'), ['ok'])
        assertStructurallySame(read('export default (...a) => { const x = (...b) => { const y = 1; return y; }; return x; };'), ['ok'])
        // a `const` after the `return`, or with no `return` after it, is no
        // body: the statements come first and the `return` is the last
        assertStructurallySame(read('export default (...a) => { return 1; const x = 1; };'), ['error', 'const'])
        assertStructurallySame(read('export default (...a) => { const x = 1; };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { const x = 1 return x; };'), ['error', 'return'])
        // `;` is required, as after every statement, and `return` is the
        // only other statement a body holds
        assertStructurallySame(read('export default (...a) => { return a };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => {};'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { a; };'), ['error', 'a'])
        assertStructurallySame(read('export default (...a) => { return a; return a; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { return; };'), ['error', ';'])
        // no line terminator between `return` and the value, where
        // JavaScript's automatic semicolon insertion would end the
        // statement and return `undefined`; a comment on the line is fine
        assertStructurallySame(read('export default (...a) => { return /* c */ a; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return\na; };'), ['error', 'nl'])
        assertStructurallySame(read('export default (...a) => { return // c\na; };'), ['error', 'nl'])
        assertStructurallySame(read('export default (...a) => { return /* x\ny */ a; };'), ['error', 'nl'])
    },
    // Any value takes accesses, `.name` and `[key]`, trivia allowed around
    // each token since a value ends with its own, and a key is a string or
    // a number.
    access: () => {
        assertStructurallySame(read('const a = {}; export default a.b;'), ['ok'])
        assertStructurallySame(read('const a = {}; export default a["b"];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[0];'), ['ok'])
        assertStructurallySame(read('const a = {}; export default a . b [ "c" ] . default [ 1 ] ;'), ['ok'])
        assertStructurallySame(read('const a = {}; export default [a.b, { c: a.b.c, }];'), ['ok'])
        assertStructurallySame(read('export default 1 .x;'), ['ok'])
        assertStructurallySame(read('export default [1].x;'), ['ok'])
        assertStructurallySame(read('export default {}.x;'), ['ok'])
        assertStructurallySame(read('export default "ab"[0].length;'), ['ok'])
        assertStructurallySame(read('export default [ 1 ] . length [ "x" ] ;'), ['ok'])
        assertStructurallySame(read('export default { a: [1] }.a[0];'), ['ok'])
        assertStructurallySame(read('export default null.x;'), ['ok'])
        assertStructurallySame(read('export default 1.x;'), ['error', 'error'])
        assertStructurallySame(read('const a = []; export default a[1n];'), ['error', 'bigint'])
        assertStructurallySame(read('const a = []; export default a[b];'), ['error', 'b'])
        assertStructurallySame(read('const a = []; export default a[];'), ['error', ']'])
        assertStructurallySame(read('const a = {}; export default a.1;'), ['error', 'number'])
        assertStructurallySame(read('const a = {}; export default a.;'), ['error', ';'])
        assertStructurallySame(read('const a = {}; export default a."b";'), ['error', 'string'])
    },
    // A group is a value in parentheses, the other thing a `(` opens: the
    // two part at the symbol after it, `...` against a value's first, so
    // one symbol of lookahead still decides and the grammar never looks
    // past the `)`.
    //
    // A group takes steps as any value does, and the value inside is the
    // whole value rule — the object included, which is what gives a
    // function returning an object its short spelling.
    group: () => {
        assertStructurallySame(read('export default (1);'), ['ok'])
        assertStructurallySame(read('export default ((1));'), ['ok'])
        assertStructurallySame(read('export default ( /* c */ 1 /* c */ ) ;'), ['ok'])
        assertStructurallySame(read('export default ({ a: 1 });'), ['ok'])
        assertStructurallySame(read('export default ([1, 2]).length;'), ['ok'])
        assertStructurallySame(read('const a = {}; export default (a).b[0];'), ['ok'])
        // a function is a value, so a group holds one, and a group is a
        // value, so a function's body is one — which is how a body spells
        // the object `=> {` cannot
        assertStructurallySame(read('export default ((...a) => 1);'), ['ok'])
        assertStructurallySame(read('export default (...a) => (a);'), ['ok'])
        assertStructurallySame(read('export default (...a) => ({ x: a });'), ['ok'])
        assertStructurallySame(read('export default (...a) => ({ x: a }).x;'), ['ok'])
        // a call on a group: the grammar takes it, and it is the same call
        // `o.b(1)` is, since parentheses keep the property reference
        assertStructurallySame(read('const o = {}; export default (o.b)(1);'), ['ok'])
        // a group holds one value and holds it: no bare comma (which waits
        // on the operator, `spec/todo/2340-operators.md`), and no missing
        // `)`. The hole is not refused here any more: `()` is a function's
        // empty parameter list, which the `(` opens wherever a value may
        // stand, so the refusal is at the `=>` that never comes. That is
        // one symbol past JavaScript's own, which backtracks to the `)`
        // once it finds no arrow — a reach this grammar does not have and
        // does not need, the spelling being refused either way. Under a
        // `-` the `(` opens a group alone, and the hole is refused at the
        // `)` there, below
        assertStructurallySame(read('export default ();'), ['error', ';'])
        assertStructurallySame(read('export default (,);'), ['error', ','])
        assertStructurallySame(read('export default (1, 2);'), ['error', ','])
        assertStructurallySame(read('export default (1;'), ['error', ';'])
        assertStructurallySame(read('export default (1));'), ['error', ')'])
        // a group is a `-`'s operand, and the only way a function reaches
        // one: `-((...a) => 1)` is a `UnaryExpression` in JavaScript where
        // `-(...a) => 1` is a syntax error, so the operand rule is the
        // group alone and the `...` is refused where JavaScript refuses it
        assertStructurallySame(read('export default -(1);'), ['ok'])
        assertStructurallySame(read('export default -(1).x;'), ['ok'])
        assertStructurallySame(read('export default - -(1);'), ['ok'])
        assertStructurallySame(read('export default -((...a) => 1);'), ['ok'])
        assertStructurallySame(read('export default -(...a) => 1;'), ['error', '...'])
        assertStructurallySame(read('export default -();'), ['error', ')'])
    },
    // A call is a step after a value, as an access is: `(` decides it, and
    // what it applies to is everything written before it. Its arguments are
    // the list an array holds — none, one, several, a trailing comma — so
    // `f(1,)` is `[1,]`'s rule, and `f(,)` is refused where `[,]` is.
    call: () => {
        assertStructurallySame(read('const f = (...a) => 1; export default f();'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default f(1);'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default f(1, "a", [2], { b: 3 });'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default f(1,);'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default f ( 1 , 2 ) ;'), ['ok'])
        // steps upon steps, in the order written
        assertStructurallySame(read('const f = (...a) => 1; export default f(1)(2);'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o.b(1).c[0](2);'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o["b"](1);'), ['ok'])
        // a call takes a value where a value stands: in a body, an array,
        // an object, a `const`, and an argument of its own
        assertStructurallySame(read('const f = (...a) => 1; export default (...b) => f(b);'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default [f(1), { x: f(2) }];'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; const x = f(1); export default x;'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default f(f(1));'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export default (...b) => { const x = f(b); return x; };'), ['ok'])
        // an argument is a value, and a hole is not one
        assertStructurallySame(read('const f = (...a) => 1; export default f(,);'), ['error', ','])
        assertStructurallySame(read('const f = (...a) => 1; export default f(1 2);'), ['error', 'number'])
        assertStructurallySame(read('const f = (...a) => 1; export default f(1;'), ['error', ';'])
        // a call is no statement of its own: it stands where a value does
        assertStructurallySame(read('const f = (...a) => 1; f(1); export default 1;'), ['error', 'f'])
        // the grammar takes a call on a numeric literal, as it takes an
        // access on one: which callees a call may have is the fold's, since
        // the grammar sees a value and not what it is
        assertStructurallySame(read('export default -1();'), ['ok'])
        assertStructurallySame(read('export default 1();'), ['ok'])
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
        parser(/** @type {Rule} */ (repeatFrom0({ importStatement, constStatement })))
        parser(/** @type {Rule} */ (exportStatement))
    },
    throw: {
        eofRejected: () => symbolOf({ token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 1 } }),
    },
}
