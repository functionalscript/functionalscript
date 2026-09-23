/**
 * The parser's proof of functions: the three parameter lists, the body,
 * captures, calls and grouping — a file beside [`proof.f.mjs`](./proof.f.mjs)
 * rather than a section of it, since a proof is read whole into one `Vec`
 * and the two together exceed the 131072 bytes one carries
 * ([`fjs/effects/node`](../../effects/node/module.mjs)). The `.f.` infix
 * is what loads it, the same as any `proof.f.mjs`.
 *
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 */

import { parseFromTokens } from './module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { _stringifyTree } from '../module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(s: string) => readonly DjsTokenWithMetadata[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s))(''))

const stringifyDjsModule = _stringifyTree

export const proof = {
    // A function: its parameter count, then its body. The rest parameter
    // is `['args']` in its body, an access on it is an access, and a name
    // bound outside — a `const`, an import, or an enclosing function's
    // parameter — is a capture, a slot of its frame (`captures` below). A
    // parameter may shadow a module name, as in JavaScript, and is an
    // identifier, so a keyword is refused as one. The list may also be
    // empty, `() => body`, which binds no name at all, or named, `named`
    // below.
    func: {
        parsed: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => a;', '[[],[["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default (...a) => [a, a[0], a["x"], (...b) => b];', '[[],[["object",[["default",["=>",0,[["array",[["args"],[".",["args"],0],[".",["args"],"x"],["=>",0,[["args"]]]]]]]]]]]]')
            expect('const f = (...a) => 1; export default [f, f];', '[[],[["=>",0,[1]],["object",[["default",["array",[["cref",0],["cref",0]]]]]]]]')
            expect('const a = 1; export default (...a) => a;', '[[],[1,["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default ( ... a ) => /* c */ a . b [ 0 ] ;', '[[],[["object",[["default",["=>",0,[[".",[".",["args"],"b"],0]]]]]]]]')
            // a body takes accesses as a value does, and a function none of its own
            expect('export default (...a) => [a][0];', '[[],[["object",[["default",["=>",0,[[".",["array",[["args"]]],0]]]]]]]]')
            expect('export default (...a) => "s"[0];', '[[],[["object",[["default",["=>",0,[[".","s",0]]]]]]]]')
        },
        // An empty parameter list binds nothing, and the AST carries no
        // name either way: `() => 1` and `(...a) => 1` are the one node, a
        // count of `0` and the body, as they are the one function in
        // JavaScript for every program that can be written here — the
        // arguments a name does not spell are unreachable, and a rest
        // parameter counts nothing towards `length`, as none does.
        noParameter: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default () => 1;', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            expect('export default ( /* c */ ) => 1;', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            expect('export default () => { return 1; };', '[[],[["object",[["default",["=>",0,[1]]]]]]]')
            // a body of its own, with its own entries, as a parameter's is
            expect('export default () => { const x = 1; return x; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            // the name a parameter would have taken is the body's to bind
            expect('export default () => { const a = 1; return a; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            // either list nests in the other, and a call needs no parameter
            expect('export default () => (...a) => a;', '[[],[["object",[["default",["=>",0,[["=>",0,[["args"]]]]]]]]]]')
            expect('export default (...a) => [a, () => 1];', '[[],[["object",[["default",["=>",0,[["array",[["args"],["=>",0,[1]]]]]]]]]]]')
            expect('const f = () => 1; export default f();', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[]]]]]]]')
        },
        // What a body with no parameter may not name: the arguments it has
        // no word for are not a name, so they answer as any other unbound
        // word does, and a name bound outside is a capture as ever.
        noParameterRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default () => a;', 'const not found', 22)
            expect('export default () => { const x = a; return x; };', 'const not found', 34)
        },
        refused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (...a) => zzz;', 'const not found', 26)
            expect('export default (...if) => 1;', 'reserved word', 20)
            expect('export default (...return) => 1;', 'reserved word', 20)
            expect('export default (...a) => a.__proto__;', 'prohibited property name', 28)
        },
        // Named parameters: the count is the list's length, unused names
        // included, and each name is bound to its position of the
        // arguments array, `['.', ['args'], i]` — a read, so a missing
        // argument is `undefined` and an extra one is passed, as in
        // JavaScript. A bare name, `(a)` and `(a, b)` are the three
        // spellings; `(a,)` is `(a)`.
        named: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default a => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a) => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a,) => a;', '[[],[["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('export default (a, b) => [b, a];', '[[],[["object",[["default",["=>",2,[["array",[[".",["args"],1],[".",["args"],0]]]]]]]]]]')
            expect('export default (a, b, c) => b;', '[[],[["object",[["default",["=>",3,[[".",["args"],1]]]]]]]]')
            // a name is read as any reference: as a base, an operand, an
            // argument, in a block
            expect('export default a => a.x[0];', '[[],[["object",[["default",["=>",1,[[".",[".",[".",["args"],0],"x"],0]]]]]]]]')
            expect('export default (a, b) => a + b;', '[[],[["object",[["default",["=>",2,[["+",[".",["args"],0],[".",["args"],1]]]]]]]]]')
            expect('export default (f, a) => f(a);', '[[],[["object",[["default",["=>",2,[["()",[".",["args"],0],[[".",["args"],1]]]]]]]]]]')
            expect('export default (a) => { const x = a; return [x, a]; };', '[[],[["object",[["default",["=>",1,[[".",["args"],0],["array",[["cref",0],[".",["args"],0]]]]]]]]]]')
            // a parameter may shadow a module name, and take a keyword's
            // place nowhere
            expect('const a = 1; export default a => a;', '[[],[1,["object",[["default",["=>",1,[[".",["args"],0]]]]]]]]')
            expect('const a = 1; export default (b) => a;', '[[],[1,["object",[["default",["=>",1,[["fref",0]],[["cref",0]]]]]]]]')
            // an enclosing function's parameter is a capture, one slot per
            // parameter, through a middle function as any capture is
            expect('export default (a) => (b) => [a, b];', '[[],[["object",[["default",["=>",1,[["=>",1,[["array",[["fref",0],[".",["args"],0]]]],[[".",["args"],0]]]]]]]]]]')
            expect('export default (a, b) => () => [b, a, b];', '[[],[["object",[["default",["=>",2,[["=>",0,[["array",[["fref",0],["fref",1],["fref",0]]]],[[".",["args"],1],[".",["args"],0]]]]]]]]]]')
            expect('export default (a) => (...b) => (c) => [a, b, c];', '[[],[["object",[["default",["=>",1,[["=>",0,[["=>",1,[["array",[["fref",0],["fref",1],[".",["args"],0]]]],[["fref",0],["args"]]]],[[".",["args"],0]]]]]]]]]]')
            // the three spellings of a list nest in one another
            expect('export default a => (b, c) => (...d) => () => 1;', '[[],[["object",[["default",["=>",1,[["=>",2,[["=>",0,[["=>",0,[1]]]]]]]]]]]]]')
            // a bare arrow in a group is the function, and the group's
            // steps apply to it: a call of it, and its `length`
            expect('export default (a => [a, a])(1);', '[[],[["object",[["default",["()",["=>",1,[["array",[[".",["args"],0],[".",["args"],0]]]]],[1]]]]]]]')
            expect('export default (a => a).length;', '[[],[["object",[["default",[".",["=>",1,[[".",["args"],0]]],"length"]]]]]]')
            expect('export default [(a => 1)];', '[[],[["object",[["default",["array",[["=>",1,[1]]]]]]]]]')
        },
        // What a named list may not be: a keyword or a repeated name, each
        // at the name; a group the grammar read an arrow after, at the
        // arrow — `(a.b) => 1` is read as JavaScript's cover grammar reads
        // it and refused as a parameter list, since a name followed by
        // anything is none; and a body `const` may not take a parameter's
        // name, as it may not take the rest parameter's.
        namedRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (if) => 1;', 'reserved word', 17)
            expect('export default (a, NaN) => 1;', 'reserved word', 20)
            expect('export default (a, return) => 1;', 'reserved word', 20)
            expect('export default (a, a) => 1;', 'duplicate id', 20)
            expect('export default (a, b, a) => 1;', 'duplicate id', 23)
            expect('export default (a.b) => 1;', 'invalid parameter list', 22)
            expect('export default (a[0]) => 1;', 'invalid parameter list', 23)
            expect('export default (a + 1) => 1;', 'invalid parameter list', 24)
            expect('export default (a ** 2) => 1;', 'invalid parameter list', 25)
            expect('export default (f()) => 1;', 'invalid parameter list', 22)
            expect('export default (a ? 1 : 2) => 1;', 'invalid parameter list', 28)
            // the names are answered for before the body is read, in order
            expect('export default (a, a) => zzz;', 'duplicate id', 20)
            expect('export default (a, if) => zzz;', 'reserved word', 20)
            expect('export default (a.b) => zzz;', 'invalid parameter list', 22)
            expect('export default (a) => { const a = 1; return a; };', 'duplicate id', 31)
            expect('export default (a, b) => { const b = 1; return a; };', 'duplicate id', 34)
            // a name the list does not spell is unbound
            expect('export default (a) => b;', 'const not found', 23)
        },
        // A name a body reads from a scope around it is a capture: the
        // function's third element lists each binding once, in the order
        // the body first names it — the enclosing scope's own reference,
        // a module's `cref` or `aref`, an enclosing body's `cref` or its
        // `args` — and the body reads capture `i` as `['fref', i]`. A
        // function nested in another captures through it, so its capture
        // is a slot of the middle one's frame. A body that captures
        // nothing has no third element.
        captures: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const c = 1; export default (...a) => c;', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            expect('import m from "./m.f.js"; export default (...a) => m;', '[[{"json":false,"specifier":"./m.f.js"}],[["object",[["default",["=>",0,[["fref",0]],[["aref",0]]]]]]]]')
            // through an operator, a conditional's arm and a call, as bare
            expect('const c = 1; export default (...a) => c + a[0];', '[[],[1,["object",[["default",["=>",0,[["+",["fref",0],[".",["args"],0]]],[["cref",0]]]]]]]]')
            expect('const c = 1; export default (...a) => a ? c : 1;', '[[],[1,["object",[["default",["=>",0,[["?:",["args"],["fref",0],1]],[["cref",0]]]]]]]]')
            expect('const f = (...a) => 1; export default (...b) => f(b);', '[[],[["=>",0,[1]],["object",[["default",["=>",0,[["()",["fref",0],[["args"]]]],[["cref",0]]]]]]]]')
            // an empty parameter list captures as any other
            expect('const c = 1; export default () => c;', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            // an enclosing function's arguments, through the middle one
            expect('export default (...a) => () => a;', '[[],[["object",[["default",["=>",0,[["=>",0,[["fref",0]],[["args"]]]]]]]]]]')
            expect('const c = 1; export default (...a) => (...b) => a;', '[[],[1,["object",[["default",["=>",0,[["=>",0,[["fref",0]],[["args"]]]]]]]]]]')
            expect(
                'export default (...a) => (...b) => (...c) => [a, b, a];',
                '[[],[["object",[["default",["=>",0,[["=>",0,[["=>",0,[["array",[["fref",0],["fref",1],["fref",0]]]],[["fref",0],["args"]]]],[["args"]]]]]]]]]]')
            // one slot per binding, in first-use order, a body `const`'s
            // value included: an alias is a binding of its own, which the
            // lowering folds into its target's node
            expect(
                'const c = [1]; const d = c; export default (...a) => { const x = c; return [d, x, c]; };',
                '[[],[["array",[1]],["cref",0],["object",[["default",["=>",0,[["fref",0],["array",[["fref",1],["cref",0],["fref",0]]]],[["cref",0],["cref",1]]]]]]]]')
            // a body `const` shadowing a module name the body never read
            // from outside
            expect('const x = [1]; export default (...a) => { const x = 2; return x; };', '[[],[["array",[1]],["object",[["default",["=>",0,[2,["cref",0]]]]]]]]')
            // a body `const` captured by a function in the body
            expect(
                'export default (...a) => { const x = [a]; return (...b) => x; };',
                '[[],[["object",[["default",["=>",0,[["array",[["args"]]],["=>",0,[["fref",0]],[["cref",0]]]]]]]]]]')
        },
        // The fold lowers a return-only block to the same executable body
        // as an expression, after the source tree has preserved its syntax.
        block: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => { return a; };', '[[],[["object",[["default",["=>",0,[["args"]]]]]]]]')
            expect('export default (...a) => { return a[0]; };', '[[],[["object",[["default",["=>",0,[[".",["args"],0]]]]]]]]')
            // the object literal an expression body cannot spell bare,
            // `=> {` opening a block — the group spells it, and `group`
            // pins that the two are one tree
            expect('export default (...a) => { return { x: 1 }; };', '[[],[["object",[["default",["=>",0,[["object",[["x",1]]]]]]]]]]')
            expect('export default (...a) => { return (...b) => { return b; }; };', '[[],[["object",[["default",["=>",0,[["=>",0,[["args"]]]]]]]]]]')
            // the parameter is still the arguments array, and a name bound
            // outside is still a capture
            expect('const c = 1; export default (...a) => { return c; };', '[[],[1,["object",[["default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
        },
        // A body `const` is an entry of the function's own body, as a
        // module's is of the module's: `['cref', i]` names entry `i` of the
        // body it is written in, the value it returns is the last entry,
        // and a `const` is one node however many references reach it.
        bodyConst: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => { const x = 1; return x; };', '[[],[["object",[["default",["=>",0,[1,["cref",0]]]]]]]]')
            expect('export default (...a) => { const x = 1; const y = 2; return [x, y]; };', '[[],[["object",[["default",["=>",0,[1,2,["array",[["cref",0],["cref",1]]]]]]]]]]')
            // a later statement names an earlier one, and the body's own
            // numbering is not the module's — both are entry 0 of their own
            expect('const m = 9; export default (...a) => { const x = 1; const y = x; return y; };', '[[],[9,["object",[["default",["=>",0,[1,["cref",0],["cref",1]]]]]]]]')
            // the parameter is in scope for the statements too
            expect('export default (...a) => { const x = a[0]; return x; };', '[[],[["object",[["default",["=>",0,[[".",["args"],0],["cref",0]]]]]]]]')
            // a nested body numbers its own entries from zero
            expect('export default (...a) => { const x = (...b) => { const y = 1; return y; }; return x; };', '[[],[["object",[["default",["=>",0,[["=>",0,[1,["cref",0]]],["cref",0]]]]]]]]')
            // an entry the return value never names is an entry all the
            // same: the body keeps it, and the lowering anchors it
            expect('export default (...a) => { const x = []; return 1; };', '[[],[["object",[["default",["=>",0,[["array",[]],1]]]]]]]')
        },
        // What a body `const` may not be named, each at the name.
        bodyConstRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (...a) => { const x = 1; const x = 2; return x; };', 'duplicate id', 47)
            // the parameter is a name of the body, so a `const` may not
            // take it — the same answer a module's duplicate gets
            expect('export default (...a) => { const a = 1; return a; };', 'duplicate id', 34)
            expect('export default (...a) => { const if = 1; return 1; };', 'reserved word', 34)
            // the name is answered for before its value is read, as a
            // module's `const` is
            expect('export default (...a) => { const NaN = zzz; return 1; };', 'reserved word', 34)
            // a statement's value is resolved in the body's scope: a name
            // nothing binds is not found, and a body `const` may take a name the
            // module binds — shadowing it — unless the body has already
            // read that name from outside, before the `const` or in its own
            // initializer: JavaScript reads the body's `const` there, and
            // the capture taken would be another value
            expect('const x = [1]; export default (...a) => { const y = x; const x = 2; return y; };', 'capture shadowed', 62)
            expect('const x = [1]; export default (...a) => { const y = (...b) => x; const x = 2; return y; };', 'capture shadowed', 72)
            expect('const x = [1]; export default (...a) => { const x = x; return x; };', 'capture shadowed', 49)
            // errors are first-to-last: a later statement's own failure is
            // not reported ahead of an earlier one
            expect('const x = [1]; export default (...a) => { const y = x; const z = zzz; const x = 2; return y; };', 'const not found', 66)
            expect('export default (...a) => { const x = zzz; return x; };', 'const not found', 38)
            // a `const` is not in its own initializer's scope
            expect('export default (...a) => { const x = x; return x; };', 'const not found', 38)
            // and a later statement is not in an earlier one's
            expect('export default (...a) => { const x = y; const y = 1; return x; };', 'const not found', 38)
        },
        // A call, `['()', callee, args]`: the callee and then the arguments
        // in the order written, which is the order they are resolved in and
        // the order an error among them is reported in. A method call keeps
        // its access as the callee here — which of the EDAG's two call
        // forms that becomes is the lowering's.
        call: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const f = (...a) => 1; export default f();', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[]]]]]]]')
            expect('const f = (...a) => 1; export default f(1, 2);', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[1,2]]]]]]]')
            expect('const o = {}; export default o.b(3);', '[[],[["object",[]],["object",[["default",["()",[".",["cref",0],"b"],[3]]]]]]]')
            expect('const f = (...a) => 1; export default f(1)(2);', '[[],[["=>",0,[1]],["object",[["default",["()",["()",["cref",0],[1]],[2]]]]]]]')
            expect('export default (...a) => a[0](1);', '[[],[["object",[["default",["=>",0,[["()",[".",["args"],0],[1]]]]]]]]]')
            // a trailing comma is the list's, as an array's is
            expect('const f = (...a) => 1; export default f(1,);', '[[],[["=>",0,[1]],["object",[["default",["()",["cref",0],[1]]]]]]]')
        },
        // A group is no node: `(x)` is whatever `x` is, so the AST is the
        // one the parentheses are not in — the sharing a module spells
        // survives them, and a step after the `)` reads the value inside.
        group: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (1);', '[[],[["object",[["default",1]]]]]')
            expect('export default ((1));', '[[],[["object",[["default",1]]]]]')
            expect('export default ( /* c */ [1] /* c */ );', '[[],[["object",[["default",["array",[1]]]]]]]')
            // the object body, which `=> {` cannot spell
            expect('export default (...a) => ({ x: 1 });', '[[],[["object",[["default",["=>",0,[["object",[["x",1]]]]]]]]]]')
            // a group takes steps, and they apply to the value it holds
            expect('export default ([1, 2]).length;', '[[],[["object",[["default",[".",["array",[1,2]],"length"]]]]]]')
            expect('const a = { b: 1 }; export default (a).b;', '[[],[["object",[["b",1]]],["object",[["default",[".",["cref",0],"b"]]]]]]')
            // a group of a reference is that reference, so two routes into
            // one `const` are the one node they were
            expect('const a = [1]; export default [(a), a];', '[[],[["array",[1]],["object",[["default",["array",[["cref",0],["cref",0]]]]]]]]')
            // and parentheses keep a property reference, as JavaScript's do
            // — `(a.at)(0) === 42` there, pinned by `chainsJs.receiver` in
            // `fjs/edag/proof.f.mjs` — so a call on a grouped access is the
            // method call, the very node `o.b(1)` is and not a detached one
            const grouped = '[[],[["object",[["b",1]]],["object",[["default",["()",[".",["cref",0],"b"],[1]]]]]]]'
            expect('const o = { b: 1 }; export default (o.b)(1);', grouped)
            expect('const o = { b: 1 }; export default ((o.b))(1);', grouped)
            expect('const o = { b: 1 }; export default o.b(1);', grouped)
            // a step reads the value in the group and nothing else, so
            // parentheses around one add no tree: a numeric literal takes
            // its access and its call as it does without them
            expect('export default (1).x;', '[[],[["object",[["default",[".",1,"x"]]]]]]')
            expect('export default 1 .x;', '[[],[["object",[["default",[".",1,"x"]]]]]]')
            expect('export default (1)(2);', '[[],[["object",[["default",["()",1,[2]]]]]]]')
            expect('export default 1(2);', '[[],[["object",[["default",["()",1,[2]]]]]]]')
            // what a group does change is how far a prefix reaches, since
            // `-` binds looser than a step: `(-1).x` is the access on the
            // negation, which nothing else spells, and `-1 .x` the negation
            // of the access, as JavaScript reads each
            expect('export default (-1).x;', '[[],[["object",[["default",[".",["-",1],"x"]]]]]]')
            expect('export default -1 .x;', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            // and the group is the `-`'s operand, the one way a function or
            // an access on a value written in place reaches a prefix
            expect('export default -(1);', '[[],[["object",[["default",["-",1]]]]]]')
            expect('export default -(1).x;', '[[],[["object",[["default",["-",[".",1,"x"]]]]]]]')
            expect('export default -((...a) => 1);', '[[],[["object",[["default",["-",["=>",0,[1]]]]]]]]')
        },
        // A group denotes its value, so it launders nothing: every rule the
        // value earns it earns inside the parentheses, at the same token.
        groupRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            // a member function a module may not call is refused whether
            // the access is called in place or grouped and called after —
            // the group is no boundary, so the callee is the access either way
            expect('const o = {}; export default (o.push)(1);', 'prohibited member function', 33)
            expect('const o = {}; export default o.push(1);', 'prohibited member function', 32)
            // and a name nothing binds is not found where it stands
            expect('export default (zzz);', 'const not found', 17)
        },
        // What a call's operands earn, each where it is written: the callee
        // is resolved before the arguments, and an argument before the ones
        // after it, so the first failure in source order is the one reported.
        callRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default zzz(1);', 'const not found', 16)
            expect('const f = (...a) => 1; export default f(zzz);', 'const not found', 41)
            expect('const f = (...a) => 1; export default f(1, zzz);', 'const not found', 44)
            expect('const f = (...a) => 1; export default f(yyy, zzz);', 'const not found', 41)
            // a method call's key is checked against the member functions a
            // module may not call: a mutator, and a data property, which is
            // no function
            expect('const o = {}; export default o.push(1);', 'prohibited member function', 32)
            expect('const o = {}; export default o.__proto__(1);', 'prohibited member function', 32)
        },
        // A method call's key is checked against `fjs/js/prototype`'s
        // `prohibitedCalls`, not the read rule: a member function the VM
        // answers by the receiver's type is a call like any other, in
        // either spelling and through a group, while the same name is still
        // refused as a read — as an argument, as a base, or alone — since a
        // detached built-in is a function that only fails.
        method: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('const o = {}; export default o.toString(1);', '[[],[["object",[]],["object",[["default",["()",[".",["cref",0],"toString"],[1]]]]]]]')
            expect('const a = []; export default a["at"](0);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('const a = []; export default (a.at)(0);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('export default [1, 2].map(1).length;', '[[],[["object",[["default",[".",["()",[".",["array",[1,2]],"map"],[1]],"length"]]]]]]')
            /** @type {(source: string, message: string, column: number) => void} */
            const refused = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            refused('const f = (...a) => 1; const o = {}; export default f(o.toString);', 'prohibited property name', 57)
            refused('const o = {}; export default o.toString.x(1);', 'prohibited property name', 32)
            refused('const o = {}; export default o.toString(1).valueOf();', 'prohibited member function', 44)
            // `length` is on neither list: a value owns it, so a call of it
            // is a call of what it holds — a function on an object, and a
            // number, thrown for at run time, on an array
            expect('const f = (...a) => 1; const o = { length: f }; export default o.length();', '[[],[["=>",0,[1]],["object",[["length",["cref",0]]]],["object",[["default",["()",[".",["cref",1],"length"],[]]]]]]]')
            expect('const a = []; export default a.length(1);', '[[],[["array",[]],["object",[["default",["()",[".",["cref",0],"length"],[1]]]]]]]')
        },
        // A call on a numeric literal is a call like any other, and the sign
        // is outside it: JavaScript reads `-1()` as `-(1())` and calls `1`,
        // which is what the prefix gives. There is nothing left to refuse —
        // the fold that made the callee `-1` is gone.
        numericCallee: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1();', '[[],[["object",[["default",["()",1,[]]]]]]]')
            expect('export default -1();', '[[],[["object",[["default",["-",["()",1,[]]]]]]]]')
            expect('export default -1n();', '[[],[["object",[["default",["-",["()",1n,[]]]]]]]]')
            expect('export default -Infinity();', '[[],[["object",[["default",["-",["()",Infinity,[]]]]]]]]')
            // an argument is read as any other is, so its own error is the
            // one reported — there is no earlier one to come first
            const [tag, value] = parseFromTokens(tokenizeString('export default 1(zzz);'))
            assert(tag === 'error', tag)
            assertEq(value.message, 'const not found')
            assertEq(value.metadata?.column, 18)
            // and a reference to a number still reads alike in both
            expect('const n = 1; export default n();', '[[],[1,["object",[["default",["()",["cref",0],[]]]]]]]')
        },
        // A body `const` may take a name the module binds. The body cannot
        // reach the module's scope at all — a reference out is a capture —
        // so the module's name is unreachable here rather than hidden, and
        // no-shadowing (`spec/todo/3150-shadowing.md`) has nothing to
        // decide about this case.
        bodyConstShadowsModule: () => {
            const [tag, value] = parseFromTokens(tokenizeString('const c = 1; export default (...a) => { const c = 2; return c; };'))
            assert(tag === 'ok', value)
            assertEq(stringifyDjsModule(value), '[[],[1,["object",[["default",["=>",0,[2,["cref",0]]]]]]]]')
        },
    },
}
