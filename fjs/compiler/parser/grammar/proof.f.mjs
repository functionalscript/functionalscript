/**
 * @import { Assert } from '../../../asserts/types.ts'
 * @import { Meta } from '../../../ebnf/ast/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { Equal } from '../../../types/ts/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Items } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { diagramPage } from '../../../ebnf/testlib.f.mjs'
import { railroadLabelMarker } from '../../../website/style/module.f.js'
import { demo, diagrams } from './demo.f.mjs'
import { parser } from '../../../ebnf/ll1/module.f.mjs'
import { repeatFrom0 } from '../../../ebnf/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { tokenize } from '../../tokenizer/module.f.mjs'
import {
    _ordinaryTokenNames as names, access, array, attribute, block, body, circuitTail, conditionalTail, constStatement,
    module, elements, func, group, identifier, importStatement, items, lastStatement, entry, loopBlock, loopCase, loopElse, loopIfStatement, loopStatement, loopSwitch, member, object, parameters, paren, statement,
    afterCase, caseTail, bodyNameStatement, moduleStatement, parenGroup, parenthesized, primitive, sym, symbolOf, template, terminator, value, whileStatement,
} from './module.f.mjs'

// The value names itself, and the tree of a whole module is too deep a
// type for `tsc` to unroll through `parser`'s return type (TS2589); the
// rules are widened to `Rule` here, where only acceptance is read.
const parseModule = parser(/** @type {Rule} */ (module))

/**
 * The parser's input for a text: its tokens, the final `eof` split off.
 *
 * @type {(s: string) => readonly Meta<ModuleTokenWithMetadata>[]}
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

/**
 * The labels a view draws, each as `kind:text`: read from the element tree
 * the page is rendered from, by the marker the stylesheet selects, rather
 * than matched in its HTML text. What follows an element's tag is its
 * attributes, its text and its child elements, in any mix.
 *
 * @type {(element: Element) => readonly string[]}
 */
const labelsOf = element => {
    const [, ...items] = element
    const text = items.filter(item => typeof item === 'string').join('')
    return items.flatMap(item =>
        typeof item === 'string' ? []
        : item instanceof Array ? labelsOf(item)
        : item[railroadLabelMarker] === undefined ? [] : [`${item[railroadLabelMarker]}:${text}`])
}

/**
 * The token kinds the demo draws as categories, written out here rather
 * than read from the demo, so a name dropped there is a failure here.
 */
const categoryNames = /** @type {const} */ ([
    'id', 'string', 'number', 'bigint',
    'noSubstitutionTemplate', 'templateHead', 'templateMiddle', 'templateTail',
])

export const proof = {
    finalWhileCandidateGrammar: () => {
        for (const source of [
            'export default ()=>{while(true){}};',
            'export default ()=>{while(false){}};',
            'export default ()=>{let n=0;while(false){}while(true){return n;}};',
            'export default n=>{switch(n){case 1:{return 1;}}while(true){return 2;}};',
            'export default n=>{if(n){while(true){return 1;}}while(true){return 2;}};',
        ]) { assertStructurallySame(read(source), ['ok']) }
        for (const source of [
            'export default ()=>{};',
            'export default ()=>{const n=1;};',
            'export default ()=>{while(true){}const n=1;};',
        ]) { assertEq(read(source)[0], 'error') }
    },
    loopSwitchesRetainBracesAndOrderedLabels: () => {
        for (const source of [
            'export default n=>{while(n){switch(n){case 1:case 2:{break;}case 3:{continue;}default:{return n;}}n=n-1;}return 0;};',
            'while(false){if(true){switch(1){case 1:{throw 2;}default:{break;}}}else{switch(2){case 2:{break;}}}}export default 3;',
            // The syntax records the whole block; source admission refuses fallthrough.
            'while(false){switch(1){case 1:{}}}export default 0;',
        ]) { assertStructurallySame(read(source), ['ok']) }
        for (const [source, token] of [
            ['while(false){switch(1){case 1:break;}}export default 0;', 'break'],
            ['while(false){switch(1){default:{break;}}}export default 0;', 'default'],
            ['while(false){switch(1){}}export default 0;', '}'],
            ['while(false){switch(1){case 1:default:{break;}}}export default 0;', 'default'],
            ['while(false){switch(1){case 1:{break;}default:{break;}case 2:{break;}}}export default 0;', 'case'],
        ]) { assertStructurallySame(read(source), ['error', token]) }
    },
    loopFunctionExitsRetainStatementBoundaries: () => {
        for (const source of [
            'export default n=>{while(n){return n;const skipped=1;throw skipped;}return 0;};',
            'export default n=>{while(n){if(n){return 1;}else if(n){throw 2;}else{return 3;}}return 0;};',
            'export default n=>{while(n){while(n){throw n;return n;}}return 0;};',
            'while(false){return 1;throw 2;const skipped=3;}export default 0;',
            'while(false){return\n1;throw\n2;}export default 0;',
        ]) {
            assertStructurallySame(read(source), ['ok'])
        }
        assertStructurallySame(read('while(false){return;}export default 0;'), ['error', ';'])
        assertStructurallySame(read('while(false){throw;}export default 0;'), ['error', ';'])
        assertStructurallySame(read('return 1;export default 0;'), ['error', 'return'])
        assertStructurallySame(read('export default ()=>{return 1;throw 2;};'), ['error', 'throw'])
    },
    // The grammar is LL(1): each rule builds in its own proof, keeping the
    // external runner's per-test timeout independent of the rule count.
    // Discard each parser so the returned reader is not a nested proof.
    ll1: {
        identifier: () => { parser(identifier) },
        primitive: () => { parser(primitive) },
        template: () => { parser(/** @type {Rule} */ (template)) },
        member: () => { parser(/** @type {Rule} */ (member)) },
        access: () => { parser(access) },
        entry: () => { parser(/** @type {Rule} */ (entry)) },
        value: () => { parser(/** @type {Rule} */ (value)) },
        array: () => { parser(/** @type {Rule} */ (array)) },
        elements: () => { parser(/** @type {Rule} */ (elements)) },
        object: () => { parser(/** @type {Rule} */ (object)) },
        parameters: () => { parser(parameters) },
        func: () => { parser(/** @type {Rule} */ (func)) },
        group: () => { parser(/** @type {Rule} */ (group)) },
        parenthesized: () => { parser(/** @type {Rule} */ (parenthesized)) },
        paren: () => { parser(/** @type {Rule} */ (paren)) },
        parenGroup: () => { parser(/** @type {Rule} */ (parenGroup)) },
        body: () => { parser(/** @type {Rule} */ (body)) },
        circuitTail: () => { parser(/** @type {Rule} */ (circuitTail)) },
        conditionalTail: () => { parser(/** @type {Rule} */ (conditionalTail)) },
        block: () => { parser(/** @type {Rule} */ (block)) },
        loopBlock: () => { parser(/** @type {Rule} */ (loopBlock)) },
        whileStatement: () => { parser(/** @type {Rule} */ (whileStatement)) },
        loopStatement: () => { parser(/** @type {Rule} */ (loopStatement)) },
        loopSwitch: () => { parser(/** @type {Rule} */ (loopSwitch)) },
        loopCase: () => { parser(/** @type {Rule} */ (loopCase)) },
        loopIfStatement: () => {
            /** @type {Rule} */
            const rule = loopIfStatement
            parser(rule)
        },
        loopElse: () => {
            /** @type {Rule} */
            const rule = loopElse
            parser(rule)
        },
        bodyNameStatement: () => { parser(/** @type {Rule} */ (bodyNameStatement)) },
        moduleStatement: () => { parser(/** @type {Rule} */ (moduleStatement)) },
        attribute: () => { parser(attribute) },
        importStatement: () => { parser(/** @type {Rule} */ (importStatement)) },
        constStatement: () => { parser(/** @type {Rule} */ (constStatement)) },
        lastStatement: () => { parser(/** @type {Rule} */ (lastStatement)) },
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
        assertEq(all.every(s => s > 0x10_FFFF), true)
        const word = symbolOf({ token: { kind: 'id', value: 'export' }, metadata: { path: 'a.js', line: 1, column: 1 }, newline: false })
        const id = symbolOf({ token: { kind: 'id', value: 'exports' }, metadata: { path: 'a.js', line: 1, column: 1 }, newline: false })
        assertEq(word.symbol, sym('export'))
        assertEq(id.symbol, sym('id'))
        assertEq(id.meta.token.kind, 'id')
        // a reserved word no rule requires is the one `keyword` symbol
        const reserved = symbolOf({ token: { kind: 'id', value: 'var' }, metadata: { path: 'a.js', line: 1, column: 1 }, newline: false })
        assertEq(reserved.symbol, sym('keyword'))
        assertEq(reserved.meta.token.kind, 'id')
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
        // a shorthand member is a bare name alone, any word among them:
        // the fold says which are references
        assertStructurallySame(read('const a = 1;export default { a };'), ['ok'])
        assertStructurallySame(read('const a = 1;export default { a, b: 2, "c": 3, ["d"]: 4, a, };'), ['ok'])
        assertStructurallySame(read('export default { return };'), ['ok'])
        // a computed key's brackets hold any value, and nothing less
        assertStructurallySame(read('const a = 1;export default { [a]: 1, [1 + 1]: 2, [[a]]: 3, [{ a }]: 4, [a => a]: 5 };'), ['ok'])
        assertStructurallySame(read('export default { []: 1 };'), ['error', ']'])
        // a string or a computed key is a key alone, and wants its `:`
        assertStructurallySame(read('export default { "a" };'), ['error', '}'])
        assertStructurallySame(read('export default { ["a"] };'), ['error', '}'])
        assertStructurallySame(read('export default { [a] };'), ['error', '}'])
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
        // an elision is an array's element, before any item, for a
        // pattern's sake: the fold refuses it in a value
        assertStructurallySame(read('export default [1,,2];'), ['ok'])
        assertStructurallySame(read('export default [,];'), ['ok'])
        assertStructurallySame(read('export default [, 1, , ,];'), ['ok'])
        assertStructurallySame(read('const [, a, , b,] = [1]; export default (c, [, d]) => d;'), ['ok'])
    },
    templates: () => {
        for (const source of [
            'export default ``;',
            'export default `plain`;',
            'export default `a${1}b${2}c`;',
            'export default `${a ? b : c}`;',
            'export default `${({ a: 1 }).a}`;',
            'export default `${() => { return 1; }}`;',
            'export default `${`nested${1}`}`;',
            'export default () => `${1}`;',
            'export default -`2`; ',
            'export default 1 + `2` ** 2;',
            'export default `${1}`.length;',
        ]) { assertStructurallySame(read(source), ['ok']) }
        assertStructurallySame(read('export default tag`plain`;'), ['error', 'noSubstitutionTemplate'])
        assertStructurallySame(read('export default tag`${1}`;'), ['error', 'templateHead'])
        assertStructurallySame(read('export default `${}`;'), ['error', 'templateTail'])
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
        // a named list: `(a)` is read as a group's value, and the `=>`
        // past the `)` makes it the one parameter, as JavaScript reads it;
        // `,` after the value makes it the first of a list or of a comma's
        // operands, every item after it a value too, a trailing comma
        // allowed, and the `=>` past the `)` makes them parameters
        assertStructurallySame(read('export default (a) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a, b) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a,) => 1;'), ['ok'])
        assertStructurallySame(read('export default ( a , b , ) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a\n, b\n) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a, b) => (c) => 1;'), ['ok'])
        // an item that is no name is the fold's to refuse, as the head is:
        // the grammar reads a value, which `(a, 1)` and `(a, b.c)` are
        assertStructurallySame(read('export default (a, 1) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a, b.c) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a, ...b) => 1;'), ['ok'])
        // a default, `= value`, after any fixed parameter, the first
        // included, a pattern too, and a fixed parameter or the rest after
        // it; `(a = 1)` is no group, so its `)` wants the `=>`, and the
        // rest parameter takes no default
        assertStructurallySame(read('export default (a = 1) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a, b = a => a, c) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a = 1, ...b) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a = 1, b = 2,) => 1;'), ['ok'])
        assertStructurallySame(read('export default ([a] = [], { b } = {}) => 1;'), ['ok'])
        assertStructurallySame(read('export default (a = 1);'), ['error', ';'])
        assertStructurallySame(read('export default (a = 1).b;'), ['error', '.'])
        assertStructurallySame(read('export default (a, ...b = 1) => 1;'), ['error', '='])
        assertStructurallySame(read('export default (a = ) => 1;'), ['error', ')'])
        assertStructurallySame(read('export default (a, b) 1;'), ['error', 'number'])
        // with no `=>` the items are a comma's operands, and a default or a
        // rest among them is the fold's to refuse, as no comma holds one
        assertStructurallySame(read('export default (a, b);'), ['ok'])
        assertStructurallySame(read('export default (a, b = 1);'), ['ok'])
        assertStructurallySame(read('export default (a, ...b);'), ['ok'])
        // the grammar admits a value at the head of the list, one symbol
        // being unable to tell `(a) => 1` from `(a).b`; that the head is a
        // name is the fold's check, `malformed parameter list`
        assertStructurallySame(read('export default (1) => 2;'), ['ok'])
        assertStructurallySame(read('export default ((a)) => 1;'), ['ok'])
        // the bare one-parameter form, `a => …`. The newline JavaScript
        // refuses before its `=>` is not the grammar's to see: trivia is
        // not in the stream, and whether a newline stood before the `=>`
        // is a fact of the token the reader in `../module.f.mjs` checks,
        // so `a\n=> 1` parses here and is refused there, at the `=>`
        assertStructurallySame(read('export default a => 1;'), ['ok'])
        assertStructurallySame(read('export default a => b => [a, b];'), ['ok'])
        assertStructurallySame(read('export default a /* c */ => 1;'), ['ok'])
        assertStructurallySame(read('export default a =>\n1;'), ['ok'])
        assertStructurallySame(read('export default a\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default (a)\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default a // c\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default a\n.b;'), ['ok'])
        assertStructurallySame(read('export default (a)\n.b;'), ['ok'])
        assertStructurallySame(read('export default a\n** 2;'), ['ok'])
        assertStructurallySame(read('export default -a => 1;'), ['error', '=>'])
        assertStructurallySame(read('export default 1 + a => 1;'), ['error', '=>'])
        assertStructurallySame(read('export default (...1) => 1;'), ['error', 'number'])
        assertStructurallySame(read('export default (...a, ...b) => 1;'), ['error', ','])
        assertStructurallySame(read('export default (,) => 1;'), ['error', ','])
        assertStructurallySame(read('export default () 1;'), ['error', 'number'])
        assertStructurallySame(read('export default () => ;'), ['error', ';'])
        assertStructurallySame(read('export default ()\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default (...a) 1;'), ['error', 'number'])
        assertStructurallySame(read('export default (...a) => ;'), ['error', ';'])
        // a comment before the `=>`, or a newline after it, changes nothing
        // the grammar sees, and a newline before it is the reader's
        assertStructurallySame(read('export default (...a) /* c */ => 1;'), ['ok'])
        assertStructurallySame(read('export default (...a) =>\n1;'), ['ok'])
        assertStructurallySame(read('export default (...a)\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default (...a) // c\n=> 1;'), ['ok'])
        assertStructurallySame(read('export default (...a) /* x\ny */ => 1;'), ['ok'])
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
        // a statement's `;` may be omitted, before the `}` and before the
        // next statement alike: the grammar reads both, and whether the
        // next statement began a line — which is what JavaScript asks of
        // it — the reader in `../module.f.mjs` checks, so `const x = 1
        // return x` is refused there and not here
        assertStructurallySame(read('export default (...a) => { const x = 1 return x; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { const x = 1\nreturn x };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return a };'), ['ok'])
        // `return` is the only other statement a body holds
        assertStructurallySame(read('export default (...a) => {};'), ['error', '}'])
        // a statement that begins with a name is read whatever value the
        // name begins, the fold admitting a call alone; the body still
        // ends in a terminator
        assertStructurallySame(read('export default (...a) => { a; };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { a; a.b(1); a?.(2)\nreturn a; };'), ['ok'])
        // one opening with anything but a name is no statement: `(` and `[`
        // would continue the one before it, and a prefix opens no call
        assertStructurallySame(read('export default (...a) => { (a)(1); return a; };'), ['error', '('])
        assertStructurallySame(read('export default (...a) => { [a].at(0); return a; };'), ['error', '['])
        assertStructurallySame(read('export default (...a) => { !a(1); return a; };'), ['error', '!'])
        assertStructurallySame(read('export default (...a) => { return a; return a; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { return; };'), ['error', ';'])
        // the line terminator JavaScript forbids between `return` and the
        // value is the reader's to see, as the one before `=>` is: the
        // grammar reads the value on the next line, and the reader refuses
        // it there
        assertStructurallySame(read('export default (...a) => { return /* c */ a; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return\na; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return // c\na; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { return /* x\ny */ a; };'), ['ok'])
        // `throw` ends a block as `return` does, one or the other and
        // nothing after either, and a module in place of its exports —
        // after its `const`s, exported or not, with nothing after it. The
        // line terminator JavaScript forbids after `throw` is the reader's
        // to see, as it is after `return`.
        assertStructurallySame(read('export default (...a) => { throw a };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { const x = 1; throw x; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { throw; };'), ['error', ';'])
        assertStructurallySame(read('export default (...a) => { throw a; return a; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { return a; throw a; };'), ['error', 'throw'])
        assertStructurallySame(read('export default (...a) => { throw\na; };'), ['ok'])
        assertStructurallySame(read('throw 1;'), ['ok'])
        assertStructurallySame(read('throw 1'), ['ok'])
        assertStructurallySame(read('import a from "./a.f.js"; const b = a; throw b;'), ['ok'])
        assertStructurallySame(read('export const a = 1; const b = a; throw b;'), ['ok'])
        assertStructurallySame(read('throw;'), ['error', ';'])
        assertStructurallySame(read('throw 1; export default 2;'), ['error', 'export'])
        assertStructurallySame(read('export default 2; throw 1;'), ['error', 'throw'])
        // a guard, `if ( value ) block`, stands where a `const` may, any
        // number of times before the terminator; its block is the block
        // rule itself, so it ends in `return` or `throw` and may hold
        // `const`s and guards of its own. No `;` follows its `}`: one there
        // is the empty statement, refused as `;;` is. The bare consequent,
        // `else`, a block that does not terminate, and a guard at module
        // level are outside the grammar.
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; } return 2; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; } return 2 };'), ['ok'])
        assertStructurallySame(read('export default (...a) => {if(a){return 1}return 2};'), ['ok'])
        assertStructurallySame(read('export default (...a) => { const x = 1; if (a) { const y = x; return y; } const z = 2; return z; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { throw 1; } return 2; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { if (a) { return 1; } return 2; } return 3; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; } if (a) { return 2; } throw 3; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) return 1; return 2; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; } else { return 2; } };'), ['error', 'else'])
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; }; return 2; };'), ['error', ';'])
        assertStructurallySame(read('export default (...a) => { if (a) { const x = 1; } return 2; };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { if (a) { return 1; } };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { if a { return 1; } return 2; };'), ['error', 'a'])
        assertStructurallySame(read('export default (...a) => { if (a) return 1; };'), ['error', 'return'])
        assertStructurallySame(read('if (1) { throw 1; } export default 2;'), ['error', 'if'])
        assertStructurallySame(read('export default 1; if (1) { throw 1; }'), ['error', 'if'])
        assertStructurallySame(read('throw 1; const a = 1;'), ['error', 'const'])
        // a `let`, `let bindingTarget = value;`, and a loop, `while (
        // value ) loopBlock`, two statements the grammar reads where a
        // `const` may stand, each on its own; source resolution and the common
        // sugar pass choose loop state. The loop's block holds `const`s,
        // `let`s, assignments, conditionals, nested loops, transfers and call
        // statements and no required terminator. The same loop also stands at module level. No `;`
        // follows its `}`.
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { r = 1; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { const x = 1; r = x; r = x; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) {} return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => {let r=0;while(r){r=1}return r};'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0\nwhile (r) { r = 1\n} return r };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let from = 0; while (from) { from = 1; } return from; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { while (a) { } return a; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { return r; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { if (r) { return 1; } } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { if (r) { r = 1; } r = 2; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { if (r) { if (r) {} } } return r; };'), ['ok'])
        assertStructurallySame(read('let r=0;while(r<2){if(r===0){r=r+1}r=r+1;}export default r;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}else{}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}else if(false){}else{}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}else if(false){}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){if(false){}else{}}else{if(false){}else{}}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}else value=1;}export default 7;'), ['error', 'value'])
        assertStructurallySame(read('while(false){if(true){}else{}else{}}export default 7;'), ['error', 'else'])
        assertStructurallySame(read('while(false){if(true){};else{}}export default 7;'), ['error', ';'])
        assertStructurallySame(read('while(false){if(true){}else{return 1;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){}else{while(false){}}}export default 7;'), ['ok'])
        assertStructurallySame(read('export default {else:1}.else;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){};}export default 7;'), ['error', ';'])
        assertStructurallySame(read('while(false){if(true){throw 1;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){while(false){}}}export default 7;'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { let x = 1; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let [r, { s }] = a; while (r) { r = 1; } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { while (r) { } } return r; };'), ['ok'])
        assertStructurallySame(read('while(false){while(false){}while(false){}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){while(false){}}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){while(false){}}else if(false){while(false){}}else{while(false){}}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){return 1;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){throw 1;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){break;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){continue;}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){break;const x=1;continue;}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){if(true){continue;}else if(false){break}else{continue}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){break\ncontinue\nconst x=1;}export default 7;'), ['ok'])
        assertStructurallySame(read('export default {break:1,continue:2}.break;'), ['ok'])
        assertStructurallySame(read('break;export default 7;'), ['error', 'break'])
        assertStructurallySame(read('continue;export default 7;'), ['error', 'continue'])
        assertStructurallySame(read('export default ()=>{break;return 7;};'), ['error', 'break'])
        assertStructurallySame(read('while(false){const f=()=>{continue;return 7;};}export default 7;'), ['error', 'continue'])
        assertStructurallySame(read('while(false){while(false){switch(1){case 1:{return 1;}}}}export default 7;'), ['ok'])
        assertStructurallySame(read('while(false){while(false){};}export default 7;'), ['error', ';'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { r = 1; }; return r; };'), ['error', ';'])
        // a `let` takes its initializer as a `const` does: `let x;` is refused
        assertStructurallySame(read('export default (...a) => { let r; while (r) { } return r; };'), ['error', ';'])
        assertStructurallySame(read('export default (...a) => { let [r]; while (r) { } return r; };'), ['error', ';'])
        // a name in the block begins the assignment or a call statement,
        // and `=` after any other value is no assignment
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { a(r); r = 1; a.b(r) } return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { a.b = 1; } return r; };'), ['error', '='])
        assertStructurallySame(read('export default (...a) => { let r = 0; while r { r = 1; } return r; };'), ['error', 'r'])
        // in a body and in a module alike, a name begins an assignment or a
        // call statement
        assertStructurallySame(read('export default (...a) => { r = 1; return r; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { r = 1; return r; } return a; };'), ['ok'])
        assertStructurallySame(read('r = 1; export default r;'), ['ok'])
        assertStructurallySame(read('let r = 0; let [s] = [r]; s = 1; export default r;'), ['ok'])
        // a reserved word begins no statement, so one opening a statement
        // is refused at the word, as no rule begins with it
        assertStructurallySame(read('export default (...a) => { var r = 1; return r; };'), ['error', 'var'])
        assertStructurallySame(read('export default (...a) => { for (r of a) { } return r; };'), ['error', 'for'])
        assertStructurallySame(read('const r = 1; eval(r); export default r;'), ['error', 'eval'])
        // and stands where a name does elsewhere, a key and a property
        assertStructurallySame(read('export default { var: 1 }.var;'), ['ok'])
        // Plain loops share their grammar at module and function scope,
        // including between named exports. The source fold checks whether a
        // return in the shared body grammar owns an ordinary function.
        assertStructurallySame(read('let r = 0; while (r) { r = 1; } export default r;'), ['ok'])
        assertStructurallySame(read('while (false) {} export default 7;'), ['ok'])
        assertStructurallySame(read('let r=0;export const before=r;while(r<2){r=r+1;}export const after=r;'), ['ok'])
        assertStructurallySame(read('let r=0;while(r<2){r=r+1;}while(r<3){r=r+1;}throw r;'), ['ok'])
        assertStructurallySame(read('while (false) {}; export default 7;'), ['error', ';'])
        assertStructurallySame(read('export default 7; while (false) {}'), ['error', 'while'])
        assertStructurallySame(read('throw 7; while (false) {}'), ['error', 'while'])
        assertStructurallySame(read('while (false) { return 7; } export default 7;'), ['ok'])
        assertStructurallySame(read('while (false) { while (false) {} } export default 7;'), ['ok'])
        assertStructurallySame(read('export let r = 0; export default r;'), ['error', 'let'])
        // `let` begins a declaration in a loop's block as in a body, so what
        // follows it is refused as no binding target
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { let = 1; } return r; };'), ['error', '='])
        // a switch, `switch ( value ) { case value : block … }`, is a
        // terminator the grammar reads where `return` and `throw` stand:
        // one or more cases, each one or more labels and then the block
        // rule itself, so every case ends in `return` or `throw`; and then
        // either `default`, its block, and the `}` of the block the switch
        // stands in, or that `}` and the rest of the block, its statements
        // and its terminator, which the switch holds. A case without
        // braces, a case that does not terminate, `break`, a `default`
        // anywhere but last or with a label stacked on it, a switch with no
        // case, a statement after a
        // switch with a `default`, a `;` after the `}`, and a switch at
        // module level are outside this grammar. Loop-body switches use
        // their own nonterminal and source admission for case completion.
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } } return 2; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } default: { return 2; } } };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: case 2: { return 1; } case 3: { throw 3; } } const x = 1; return x; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => {switch(a){case 1:{return 1}default:{return 2}}};'), ['ok'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } } switch (a) { case 2: { return 2; } } return 3; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { switch (a) { case 2: { return 2; } } return 1; } default: { if (a) { return 3; } return 4; } } };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { if (a) { switch (a) { case 1: { return 1; } default: { return 2; } } } return 3; };'), ['ok'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: return 1; } return 2; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { const x = 1; } } return 2; };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { break; } } return 2; };'), ['error', 'break'])
        assertStructurallySame(read('export default (...a) => { switch (a) { default: { return 2; } case 1: { return 1; } } };'), ['error', 'default'])
        assertStructurallySame(read('export default (...a) => { switch (a) { default: { return 2; } } };'), ['error', 'default'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: default: { return 1; } } };'), ['error', 'default'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } default: case 2: { return 2; } } };'), ['error', 'case'])
        assertStructurallySame(read('export default (...a) => { switch (a) { } return 2; };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } default: { return 2; } } return 3; };'), ['error', 'return'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } } };'), ['error', '}'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case 1: { return 1; } }; return 2; };'), ['error', ';'])
        assertStructurallySame(read('export default (...a) => { switch a { case 1: { return 1; } } return 2; };'), ['error', 'a'])
        assertStructurallySame(read('export default (...a) => { switch (a) { case: { return 1; } } return 2; };'), ['error', ':'])
        assertStructurallySame(read('switch (1) { case 1: { throw 1; } } export default 2;'), ['error', 'switch'])
        assertStructurallySame(read('export default (...a) => { let r = 0; while (r) { switch (r) { case 1: { return 1; } } } return r; };'), ['ok'])
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
        // an index holds any value, which the fold judges: a constant or the
        // conversion, `a[Number(b)]`, and every other value refused there
        assertStructurallySame(read('const a = []; export default a[1n];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[b];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[Number(b)]?.[Number(c)];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[b + 1 ? [c] : {}];'), ['ok'])
        assertStructurallySame(read('const a = []; export default a[];'), ['error', ']'])
        assertStructurallySame(read('const a = []; export default a[b;'), ['error', ';'])
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
        // a group holds one value or a comma's operands, and holds them: no
        // missing `)`. The hole is not refused here any more: `()` is a function's
        // empty parameter list, which the `(` opens wherever a value may
        // stand, so the refusal is at the `=>` that never comes. That is
        // one symbol past JavaScript's own, which backtracks to the `)`
        // once it finds no arrow — a reach this grammar does not have and
        // does not need, the spelling being refused either way. Under a
        // `-` the `(` opens a group alone, and the hole is refused at the
        // `)` there, below
        assertStructurallySame(read('export default ();'), ['error', ';'])
        assertStructurallySame(read('export default (,);'), ['error', ','])
        // a comma after the value opens the rest of a named list or of a
        // comma's operands, which the `)` decides: `(1, 2)` is a comma
        assertStructurallySame(read('export default (1, 2);'), ['ok'])
        assertStructurallySame(read('export default (1, (2, 3)).x;'), ['ok'])
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
        // under a prefix and as an operand a group holds a comma too, its
        // operands values and nothing else, so the grammar itself refuses
        // a trailing comma, a default and a rest there
        assertStructurallySame(read('export default -(1, 2);'), ['ok'])
        assertStructurallySame(read('export default -(1, 2).x;'), ['ok'])
        assertStructurallySame(read('export default 1 + (2, 3) ** 2;'), ['ok'])
        assertStructurallySame(read('export default -(1, 2,);'), ['error', ')'])
        assertStructurallySame(read('export default -(1, a = 2);'), ['error', '='])
        assertStructurallySame(read('export default -(1, ...a);'), ['error', '...'])
    },
    // A call is a step after a value, as an access is: `(` decides it, and
    // what it applies to is everything written before it. Its arguments are
    // the list an array holds — none, one, several, a trailing comma — so
    // `f(1,)` is `[1,]`'s rule; but no elision, which only an array holds,
    // so `f(,)` is refused where `[,]` is read.
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
        // a call is a statement of its own, before the exports and among
        // the exported `const`s
        assertStructurallySame(read('const f = (...a) => 1; f(1); export default 1;'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; export const a = 1; f(a)\nexport const b = 2;'), ['ok'])
        assertStructurallySame(read('const f = (...a) => 1; f(1); export f(2);'), ['error', 'f'])
        // the grammar takes a call on a numeric literal, as it takes an
        // access on one: which callees a call may have is the fold's, since
        // the grammar sees a value and not what it is
        assertStructurallySame(read('export default -1();'), ['ok'])
        assertStructurallySame(read('export default 1();'), ['ok'])
    },
    // The optional step, `?.` and then a name, `[key]` or `(args)`: one
    // more step a value takes, as `.`, `[` and `(` are, so it stands where
    // they stand and takes what they take.
    optional: () => {
        assertStructurallySame(read('const o = {}; export default o?.b;'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o?.["b"];'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o?.[0];'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o?.(1);'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o?.();'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o?.b.c(1)?.d?.(2)[0]?.["e"]();'), ['ok'])
        assertStructurallySame(read('const o = {}; export default (o?.b).c;'), ['ok'])
        assertStructurallySame(read('const o = {}; export default [1]?.length;'), ['ok'])
        assertStructurallySame(read('const o = {}; export default o ?. b;'), ['ok'])
        assertStructurallySame(read('const o = {}; export default (...a) => a?.[0];'), ['ok'])
        // the `?.` wants its step: a name, a key or a call list
        assertStructurallySame(read('const o = {}; export default o?.;'), ['error', ';'])
        assertStructurallySame(read('const o = {}; export default o?.1;'), ['error', 'number'])
        assertStructurallySame(read('const o = {}; export default o?.[];'), ['error', ']'])
        assertStructurallySame(read('const o = {}; export default o?.(,);'), ['error', ','])
        assertStructurallySame(read('const o = {}; export default o?.b?.;'), ['error', ';'])
    },
    // Stage B of `spec/operators/README.md`: the lazy operators and the
    // conditional, above the eager ladder. `&&` and `||` chain as in
    // JavaScript, `??` chains with itself alone, and `?:` takes whole
    // values for its arms. The shape refuses what JavaScript's grammar
    // refuses — `??` beside `&&`/`||` at one nesting, and `**` after a
    // prefix — at the token, with no check after the parse.
    lazy: () => {
        assertStructurallySame(read('const a = 1; const b = 2; export default a && b;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a || b;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a ?? b;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a && b && a || b || a && b;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a || b && a;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a ?? b ?? a;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a | b && a + b ?? a;'), ['error', '??'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a ?? b || a;'), ['error', '||'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a ?? b && a;'), ['error', '&&'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a && b ?? a;'), ['error', '??'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a || b ?? a;'), ['error', '??'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a || b && a ?? b;'), ['error', '??'])
        // parentheses admit either mix, as JavaScript's do
        assertStructurallySame(read('const a = 1; const b = 2; export default (a ?? b) || a;'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a ?? (b || a);'), ['ok'])
        assertStructurallySame(read('const a = 1; const b = 2; export default a && (b ?? a);'), ['ok'])
        // the operand is the eager ladder's, so a lazy operator takes
        // every eager operator without parentheses and no operand of its
        // own is a function
        assertStructurallySame(read('const a = 1; const b = 2; export default a + b && a | b ?? a;'), ['error', '??'])
        assertStructurallySame(read('const a = 1; const b = 2; export default -a && ~b ** 2;'), ['error', '**'])
        assertStructurallySame(read('const a = 1; export default a && (...b) => b;'), ['error', '...'])
        assertStructurallySame(read('const a = 1; export default a && ((...b) => b);'), ['ok'])
        // a chain stands wherever a value does, its own trivia around each token
        assertStructurallySame(read('const a = 1; export default [a && a, { x: a ?? a }, (a || a).x];'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a /* c */ &&\n a;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default (...b) => b && a;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a &&;'), ['error', ';'])
        assertStructurallySame(read('const a = 1; export default && a;'), ['error', '&&'])
    },
    // The conditional: `? value : value` after the short-circuit level,
    // each arm a whole value, so a nested conditional in either arm needs
    // no parentheses and a function may stand as an arm — its body ends
    // where `:` cannot continue it, as JavaScript reads `a ? () => 1 : 2`.
    conditional: () => {
        assertStructurallySame(read('const a = 1; export default a ? 1 : 2;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a?1:2;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a ? a ? 1 : 2 : a ? 3 : 4;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a && a ? a || a : a ?? a;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a ? () => 1 : 2;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a ? 1 : () => 2;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default a ? { x: a ? 1 : 2 } : [a ? 1 : 2];'), ['ok'])
        assertStructurallySame(read('const a = 1; export default (a ? 1 : 2).x;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default (...b) => b ? 1 : 2;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default -a ? -1 : ~1;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default !a ? !1 : !!a;'), ['ok'])
        assertStructurallySame(read('export default !2 ** 2;'), ['error', '**'])
        assertStructurallySame(read('const a = 1; export default typeof a ? typeof 1 : typeof typeof a;'), ['ok'])
        assertStructurallySame(read('export default typeof 2 ** 2;'), ['error', '**'])
        assertStructurallySame(read('export default { typeof: 1 }.typeof;'), ['ok'])
        // `instanceof` is a relational operator: its right operand is any
        // value here, and which one the fold admits is the fold's
        assertStructurallySame(read('const a = 1; export default a instanceof Array ? a instanceof (Array) : [] instanceof Map;'), ['ok'])
        assertStructurallySame(read('export default { instanceof: 1 }.instanceof;'), ['ok'])
        assertStructurallySame(read('export default instanceof;'), ['ok'])
        // the arms are values, not one of them a function's parameter
        // list or a hole; both are required, and the conditional is no
        // operand of the operators below it
        assertStructurallySame(read('const a = 1; export default a ? 1;'), ['error', ';'])
        assertStructurallySame(read('const a = 1; export default a ? : 2;'), ['error', ':'])
        assertStructurallySame(read('const a = 1; export default a ? 1 : ;'), ['error', ';'])
        assertStructurallySame(read('const a = 1; export default a ? 1 : 2 : 3;'), ['error', ':'])
        assertStructurallySame(read('const a = 1; export default a ? 1 : 2 + 3 && a ? 4 : 5;'), ['ok'])
        assertStructurallySame(read('const a = 1; export default -(a ? 1 : 2);'), ['ok'])
        // `?.` is one token, the optional step's, so `a ?. 1 : 2` is no
        // conditional: the step wants a name, `[` or `(` after it
        assertStructurallySame(read('const a = 1; export default a ?. 1 : 2;'), ['error', 'number'])
    },
    // A statement ends at `;`, or at nothing: the grammar reads a module
    // whose statements omit it, however they stand, since `;` begins no
    // statement and one symbol of lookahead still decides. Whether a
    // statement after an omitted `;` began a line — JavaScript's own rule —
    // is a fact of the token, which the reader in `../module.f.mjs` checks:
    // `const a = 1 export default a;` is that reader's to refuse. Two `;`
    // are still one too many: there is no empty statement.
    terminator: () => {
        assertStructurallySame(read('export default 1'), ['ok'])
        assertStructurallySame(read('export default 1\n'), ['ok'])
        assertStructurallySame(read('const a = 1\nexport default a;'), ['ok'])
        assertStructurallySame(read('const a = 1 export default a;'), ['ok'])
        assertStructurallySame(read('import x from "m"\nconst a = x\nexport default a'), ['ok'])
        assertStructurallySame(read('export default 1;;'), ['error', ';'])
        assertStructurallySame(read('export default 1\n;;'), ['error', ';'])
    },
    refused: () => {
        assertStructurallySame(read(''), ['error', 'end'])
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
        parser(/** @type {Rule} */ (lastStatement))
        // a block's statement: `const` and `if` decide the two in one symbol
        parser(/** @type {Rule} */ (statement))
        // a block's end: `return`, `throw` and `switch` decide the three,
        // and `default` and `}` a switch's tail
        parser(/** @type {Rule} */ (terminator))
        // a case's labels and its block: `case` and `{` decide the two,
        // and after the block `case`, `default` and `}` the three
        parser(/** @type {Rule} */ (caseTail))
        parser(/** @type {Rule} */ (afterCase))
    },
    demo: {
        // A diagram per title, and a diagram for every box.
        page: diagramPage(demo, diagrams),
        // Each token that stands for any token of its kind is a category,
        // and a token that is its own text a terminal.
        labels: () => {
            const labels = labelsOf(demo.view(demo.init))
            categoryNames.forEach(name => assert(labels.includes(`category:${name}`), name))
            assert(labels.includes('terminal:=>'), '=>')
        },
    },
    throw: {
        eofRejected: () => symbolOf({ token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 1 }, newline: false }),
    },
}
