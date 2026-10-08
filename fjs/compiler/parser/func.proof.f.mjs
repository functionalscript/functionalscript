/**
 * The proof of the parser's functions: their parameter lists, bodies and captures, split off `./proof.f.mjs` when that file
 * outgrew what the website's build accepts in one file — 128 KiB, which it
 * passed at `e15e2ea` — along the seam its own sections drew. It reads the
 * parser as that proof does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { parseFromTokens } from './module.f.mjs'
import { stringifyDjsModule, tokenizeString } from './proof.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    // A function: the rest parameter is `['args']` in its body, an access
    // on it is an access, and a name bound outside — a `const`, an import,
    // or an enclosing function's parameter — is a capture, a slot of its
    // frame (`captures` below). A parameter may shadow a module name, as in JavaScript, and is
    // an identifier, so a keyword is refused as one. The list may also be
    // empty, `() => body`, which binds no name at all.
    func: {
        parsed: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (...a) => a;', '[[],[["object",[[":","default",["=>",0,[["rest"]]]]]]]]')
            expect('export default (...a) => [a, a[0], a["x"], (...b) => b];', '[[],[["object",[[":","default",["=>",0,[["array",[["rest"],[".",["rest"],0],[".",["rest"],"x"],["=>",0,[["rest"]]]]]]]]]]]]')
            expect('const f = (...a) => 1; export default [f, f];', '[[],[["=>",0,[1]],["object",[[":","default",["array",[["cref",0],["cref",0]]]]]]]]')
            expect('const a = 1; export default (...a) => a;', '[[],[1,["object",[[":","default",["=>",0,[["rest"]]]]]]]]')
            expect('export default ( ... a ) => /* c */ a . b [ 0 ] ;', '[[],[["object",[[":","default",["=>",0,[[".",[".",["rest"],"b"],0]]]]]]]]')
            // a body takes accesses as a value does, and a function none of its own
            expect('export default (...a) => [a][0];', '[[],[["object",[[":","default",["=>",0,[[".",["array",[["rest"]]],0]]]]]]]]')
            expect('export default (...a) => "s"[0];', '[[],[["object",[[":","default",["=>",0,[[".","s",0]]]]]]]]')
        },
        // An empty parameter list binds nothing, and the AST carries no
        // parameter either way: `() => 1` and `(...a) => 1` are the one
        // node, as they are the one function in JavaScript for every
        // program that can be written here — the arguments a name does not
        // spell are unreachable, and `f.name` and `f.length` are refused at
        // the key of `.`.
        noParameter: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default () => 1;', '[[],[["object",[[":","default",["=>",0,[1]]]]]]]')
            expect('export default ( /* c */ ) => 1;', '[[],[["object",[[":","default",["=>",0,[1]]]]]]]')
            expect('export default () => { return 1; };', '[[],[["object",[[":","default",["=>",0,[1]]]]]]]')
            // a body of its own, with its own entries, as a parameter's is
            expect('export default () => { const x = 1; return x; };', '[[],[["object",[[":","default",["=>",0,[1,["cref",0]]]]]]]]')
            // the name a parameter would have taken is the body's to bind
            expect('export default () => { const a = 1; return a; };', '[[],[["object",[[":","default",["=>",0,[1,["cref",0]]]]]]]]')
            // either list nests in the other, and a call needs no parameter
            expect('export default () => (...a) => a;', '[[],[["object",[[":","default",["=>",0,[["=>",0,[["rest"]]]]]]]]]]')
            expect('export default (...a) => [a, () => 1];', '[[],[["object",[[":","default",["=>",0,[["array",[["rest"],["=>",0,[1]]]]]]]]]]]')
            expect('const f = () => 1; export default f();', '[[],[["=>",0,[1]],["object",[[":","default",["()",["cref",0],[]]]]]]]')
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
        // A block may end in `throw` in place of its `return`: the body's
        // last entry is the throw of the value, and nothing else changes —
        // the `const`s before it are its entries, the value is resolved in
        // the body's scope, a capture is a capture, and the `;` may be
        // omitted where JavaScript inserts it.
        throws: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default () => { throw 1; };', '[[],[["object",[[":","default",["=>",0,[["throw",1]]]]]]]]')
            expect('export default () => { throw 1 };', '[[],[["object",[[":","default",["=>",0,[["throw",1]]]]]]]]')
            expect('export default (...a) => { const x = a[0]; throw [x, x]; };', '[[],[["object",[[":","default",["=>",0,[[".",["rest"],0],["throw",["array",[["cref",0],["cref",0]]]]]]]]]]]')
            expect('const c = 1; export default () => { throw c; };', '[[],[1,["object",[[":","default",["=>",0,[["throw",["fref",0]]],[["cref",0]]]]]]]]')
            expect('export default () => {\n    const x = 1\n    throw x\n}', '[[],[["object",[[":","default",["=>",0,[1,["throw",["cref",0]]]]]]]]]')
        },
        // `throw [no LineTerminator here] value`, as `return` has it — a
        // value on the next line is refused at its first token; a `throw`
        // with no value, and a statement after one, are the grammar's to
        // refuse; a name nothing binds is the fold's, and `throw` is no
        // name a parameter may take.
        throwRefused: () => {
            /** @type {(source: string, message: string, line: number, column: number) => void} */
            const expect = (source, message, line, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.line, line)
                assertEq(value.metadata?.column, column)
            }
            expect('export default () => { throw\n1; };', 'unexpected token', 2, 1)
            expect('export default () => { throw; };', 'unexpected token', 1, 29)
            expect('export default () => { throw 1; return 2; };', 'unexpected token', 1, 33)
            expect('export default () => { const x = 1 throw x; };', 'unexpected token', 1, 36)
            expect('export default () => { throw zzz; };', 'const not found', 1, 30)
            expect('export default (...throw) => 1;', 'reserved word', 1, 20)
        },
        // A guard, `if (c) { … }`, is folded to what it is sugar for: its
        // block and the statements after it are each the body of a
        // parameterless function called where it stands — the call the
        // lowering inlines — and the guard is the conditional of the two.
        // A `const` after the guard is an entry of the second arm's body,
        // what either arm reads from the enclosing body a capture, and a
        // second guard nests as the alternate of the first.
        guards: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('export default (a) => { if (a) { return 1; } return 2; };', '[[],[["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[1]],[]],["()",["=>",0,[2]],[]]]]]]]]]]')
            expect('export default (a) => {\n    if (a) { return 1 }\n    return 2\n}', '[[],[["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[1]],[]],["()",["=>",0,[2]],[]]]]]]]]]]')
            expect('export default (a) => { if (a) { const x = [1]; return [x, x]; } return 0; };', '[[],[["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[["array",[1]],["array",[["cref",0],["cref",0]]]]],[]],["()",["=>",0,[0]],[]]]]]]]]]]')
            expect('export default (m) => { const a = [1]; if (m) { return a; } return 0; };', '[[],[["object",[[":","default",["=>",1,[["array",[1]],["?:",["arg",0],["()",["=>",0,[["fref",0]],[["cref",0]]],[]],["()",["=>",0,[0]],[]]]]]]]]]]')
            expect('export default (a) => { if (a) { throw 1; } const y = [2]; return y; };', '[[],[["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[["throw",1]]],[]],["()",["=>",0,[["array",[2]],["cref",0]]],[]]]]]]]]]]')
            expect('export default (a) => { if (a) { return 1; } if (a) { return 2; } return 3; };', '[[],[["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[1]],[]],["()",["=>",0,[["?:",["fref",0],["()",["=>",0,[2]],[]],["()",["=>",0,[3]],[]]]],[["arg",0]]],[]]]]]]]]]]')
            expect('export default (...a) => { if (a[0]) { return a; } return a[1]; };', '[[],[["object",[[":","default",["=>",0,[["?:",[".",["rest"],0],["()",["=>",0,[["fref",0]],[["rest"]]],[]],["()",["=>",0,[[".",["fref",0],1]],[["rest"]]],[]]]]]]]]]]')
            expect('const c = [1]; export default (a) => { if (a) { return c; } return [c]; };', '[[],[["array",[1]],["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[["fref",0]],[["fref",0]]],[]],["()",["=>",0,[["array",[["fref",0]]]],[["fref",0]]],[]]]],[["cref",0]]]]]]]]')
            // the guard's block is a block of JavaScript's own, so it may
            // bind a name the body has bound, or one the condition read
            // from outside
            expect('export default (a) => { const b = 1; if (a) { const b = 2; return b; } return b; };', '[[],[["object",[[":","default",["=>",1,[1,["?:",["arg",0],["()",["=>",0,[2,["cref",0]]],[]],["()",["=>",0,[["fref",0]],[["cref",0]]],[]]]]]]]]]]')
            expect('const x = 10; export default (a) => { if (x) { const x = 2; return x; } return 0; };', '[[],[10,["object",[[":","default",["=>",1,[["?:",["fref",0],["()",["=>",0,[2,["cref",0]]],[]],["()",["=>",0,[0]],[]]]],[["cref",0]]]]]]]]')
            // and the statements after the guard read from outside as the
            // body does, a capture of the arm through the body
            expect('const x = 10; export default (a) => { if (a) { return 1; } const y = x; return y; };', '[[],[10,["object",[[":","default",["=>",1,[["?:",["arg",0],["()",["=>",0,[1]],[]],["()",["=>",0,[["fref",0],["cref",0]],[["fref",0]]],[]]]],[["cref",0]]]]]]]]')
        },
        // The forms outside this step are refused where the grammar stops:
        // the bare consequent, `else`, a `;` after the `}`, a block that
        // does not terminate, and a guard at module level. The statements
        // after a guard are JavaScript's one block with the ones before
        // it, so a name that block has bound — a parameter, a `const`
        // before the guard, or one after an earlier guard — is `duplicate
        // id` there, as it is in JavaScript, and a word that block has
        // already read from outside — in the condition, in the guard's
        // block, or before the guard — is `capture shadowed`, since in
        // JavaScript every such read would have named the later `const`
        // before its declaration; a name nothing binds is `const not
        // found` in either arm; and the line rules hold across a guard as
        // they do elsewhere.
        guardRefused: () => {
            /** @type {(source: string, message: string, line: number, column: number) => void} */
            const expect = (source, message, line, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.line, line)
                assertEq(value.metadata?.column, column)
            }
            expect('export default (a) => { if (a) return 1; return 2; };', 'unexpected token', 1, 32)
            expect('export default (a) => { if (a) { return 1; } else { return 2; } };', 'unexpected token', 1, 46)
            expect('export default (a) => { if (a) { return 1; }; return 2; };', 'unexpected token', 1, 45)
            expect('export default (a) => { if (a) { const x = 1; } return 2; };', 'unexpected token', 1, 47)
            expect('export default (a) => { if (a) { return 1; } };', 'unexpected token', 1, 46)
            expect('if (1) { throw 1; } export default 2;', 'unexpected token', 1, 1)
            expect('export default (a) => { if (a) { return 1; } const a = 2; return a; };', 'duplicate id', 1, 52)
            expect('export default (a) => { const b = 1; if (a) { return 1; } const b = 2; return b; };', 'duplicate id', 1, 65)
            expect('export default (a) => { if (a) { return 1; } if (a) { return 2; } const a = 3; return a; };', 'duplicate id', 1, 73)
            expect('export default (a) => { if (a) { return 1; } const x = a; const x = 2; return x; };', 'duplicate id', 1, 65)
            expect('const x = 10; export default (a) => { if (x) { return 1; } const x = 2; return x; };', 'capture shadowed', 1, 66)
            expect('const x = 10; export default (a) => { if (a) { return x; } const x = 2; return x; };', 'capture shadowed', 1, 66)
            expect('const x = 10; export default (a) => { if (a) { return (() => x)(); } const x = 2; return x; };', 'capture shadowed', 1, 76)
            expect('const x = 10; export default (a) => { if (a) { return 1; } if (x) { return 2; } const x = 3; return x; };', 'capture shadowed', 1, 87)
            expect('export default (a) => { if (a) { return zzz; } return 1; };', 'const not found', 1, 41)
            expect('export default (a) => { if (a) { return 1; } return zzz; };', 'const not found', 1, 53)
            expect('export default (a) => { if (zzz) { return 1; } return 2; };', 'const not found', 1, 29)
            expect('export default (a) => { if (a) { return 1; } const if = 1; return 2; };', 'reserved word', 1, 52)
            expect('export default (a) => { if (a) { return 1; } const b = 1 return b; };', 'unexpected token', 1, 58)
            expect('export default (a) => { const b = 1 if (a) { return 1; } return b; };', 'unexpected token', 1, 37)
            expect('export default (a) => { if (a) { return\n1; } return 2; };', 'unexpected token', 2, 1)
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
            expect('const c = 1; export default (...a) => c;', '[[],[1,["object",[[":","default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            expect('import m from "./m.f.js"; export default (...a) => m;', '[[{"json":false,"name":"default","specifier":"./m.f.js"}],[["object",[[":","default",["=>",0,[["fref",0]],[["aref",0]]]]]]]]')
            // through an operator, a conditional's arm and a call, as bare
            expect('const c = 1; export default (...a) => c + a[0];', '[[],[1,["object",[[":","default",["=>",0,[["+",["fref",0],[".",["rest"],0]]],[["cref",0]]]]]]]]')
            expect('const c = 1; export default (...a) => a ? c : 1;', '[[],[1,["object",[[":","default",["=>",0,[["?:",["rest"],["fref",0],1]],[["cref",0]]]]]]]]')
            expect('const f = (...a) => 1; export default (...b) => f(b);', '[[],[["=>",0,[1]],["object",[[":","default",["=>",0,[["()",["fref",0],[["rest"]]]],[["cref",0]]]]]]]]')
            // an empty parameter list captures as any other
            expect('const c = 1; export default () => c;', '[[],[1,["object",[[":","default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
            // an enclosing function's arguments, through the middle one
            expect('export default (...a) => () => a;', '[[],[["object",[[":","default",["=>",0,[["=>",0,[["fref",0]],[["rest"]]]]]]]]]]')
            expect('const c = 1; export default (...a) => (...b) => a;', '[[],[1,["object",[[":","default",["=>",0,[["=>",0,[["fref",0]],[["rest"]]]]]]]]]]')
            expect(
                'export default (...a) => (...b) => (...c) => [a, b, a];',
                '[[],[["object",[[":","default",["=>",0,[["=>",0,[["=>",0,[["array",[["fref",0],["fref",1],["fref",0]]]],[["fref",0],["rest"]]]],[["rest"]]]]]]]]]]')
            // one slot per binding, in first-use order, a body `const`'s
            // value included: an alias is a binding of its own, which the
            // lowering folds into its target's node
            expect(
                'const c = [1]; const d = c; export default (...a) => { const x = c; return [d, x, c]; };',
                '[[],[["array",[1]],["cref",0],["object",[[":","default",["=>",0,[["fref",0],["array",[["fref",1],["cref",0],["fref",0]]]],[["cref",0],["cref",1]]]]]]]]')
            // a body `const` shadowing a module name the body never read
            // from outside
            expect('const x = [1]; export default (...a) => { const x = 2; return x; };', '[[],[["array",[1]],["object",[[":","default",["=>",0,[2,["cref",0]]]]]]]]')
            // a body `const` captured by a function in the body
            expect(
                'export default (...a) => { const x = [a]; return (...b) => x; };',
                '[[],[["object",[[":","default",["=>",0,[["array",[["rest"]]],["=>",0,[["fref",0]],[["cref",0]]]]]]]]]]')
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
            expect('export default (...a) => { return a; };', '[[],[["object",[[":","default",["=>",0,[["rest"]]]]]]]]')
            expect('export default (...a) => { return a[0]; };', '[[],[["object",[[":","default",["=>",0,[[".",["rest"],0]]]]]]]]')
            // the object literal an expression body cannot spell bare,
            // `=> {` opening a block — the group spells it, and `group`
            // pins that the two are one tree
            expect('export default (...a) => { return { x: 1 }; };', '[[],[["object",[[":","default",["=>",0,[["object",[[":","x",1]]]]]]]]]]')
            expect('export default (...a) => { return (...b) => { return b; }; };', '[[],[["object",[[":","default",["=>",0,[["=>",0,[["rest"]]]]]]]]]]')
            // the parameter is still the arguments array, and a name bound
            // outside is still a capture
            expect('const c = 1; export default (...a) => { return c; };', '[[],[1,["object",[[":","default",["=>",0,[["fref",0]],[["cref",0]]]]]]]]')
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
            expect('export default (...a) => { const x = 1; return x; };', '[[],[["object",[[":","default",["=>",0,[1,["cref",0]]]]]]]]')
            expect('export default (...a) => { const x = 1; const y = 2; return [x, y]; };', '[[],[["object",[[":","default",["=>",0,[1,2,["array",[["cref",0],["cref",1]]]]]]]]]]')
            // a later statement names an earlier one, and the body's own
            // numbering is not the module's — both are entry 0 of their own
            expect('const m = 9; export default (...a) => { const x = 1; const y = x; return y; };', '[[],[9,["object",[[":","default",["=>",0,[1,["cref",0],["cref",1]]]]]]]]')
            // the parameter is in scope for the statements too
            expect('export default (...a) => { const x = a[0]; return x; };', '[[],[["object",[[":","default",["=>",0,[[".",["rest"],0],["cref",0]]]]]]]]')
            // a nested body numbers its own entries from zero
            expect('export default (...a) => { const x = (...b) => { const y = 1; return y; }; return x; };', '[[],[["object",[[":","default",["=>",0,[["=>",0,[1,["cref",0]]],["cref",0]]]]]]]]')
            // an entry the return value never names is an entry all the
            // same: the body keeps it, and the lowering anchors it
            expect('export default (...a) => { const x = []; return 1; };', '[[],[["object",[[":","default",["=>",0,[["array",[]],1]]]]]]]')
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
            expect('const f = (...a) => 1; export default f();', '[[],[["=>",0,[1]],["object",[[":","default",["()",["cref",0],[]]]]]]]')
            expect('const f = (...a) => 1; export default f(1, 2);', '[[],[["=>",0,[1]],["object",[[":","default",["()",["cref",0],[1,2]]]]]]]')
            expect('const o = {}; export default o.b(3);', '[[],[["object",[]],["object",[[":","default",["()",[".",["cref",0],"b"],[3]]]]]]]')
            expect('const f = (...a) => 1; export default f(1)(2);', '[[],[["=>",0,[1]],["object",[[":","default",["()",["()",["cref",0],[1]],[2]]]]]]]')
            expect('export default (...a) => a[0](1);', '[[],[["object",[[":","default",["=>",0,[["()",[".",["rest"],0],[1]]]]]]]]]')
            // a trailing comma is the list's, as an array's is
            expect('const f = (...a) => 1; export default f(1,);', '[[],[["=>",0,[1]],["object",[[":","default",["()",["cref",0],[1]]]]]]]')
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
            expect('export default (1);', '[[],[["object",[[":","default",1]]]]]')
            expect('export default ((1));', '[[],[["object",[[":","default",1]]]]]')
            expect('export default ( /* c */ [1] /* c */ );', '[[],[["object",[[":","default",["array",[1]]]]]]]')
            // the object body, which `=> {` cannot spell
            expect('export default (...a) => ({ x: 1 });', '[[],[["object",[[":","default",["=>",0,[["object",[[":","x",1]]]]]]]]]]')
            // a group takes steps, and they apply to the value it holds
            expect('export default ([1, 2]).length;', '[[],[["object",[[":","default",[".",["array",[1,2]],"length"]]]]]]')
            expect('const a = { b: 1 }; export default (a).b;', '[[],[["object",[[":","b",1]]],["object",[[":","default",[".",["cref",0],"b"]]]]]]')
            // a group of a reference is that reference, so two routes into
            // one `const` are the one node they were
            expect('const a = [1]; export default [(a), a];', '[[],[["array",[1]],["object",[[":","default",["array",[["cref",0],["cref",0]]]]]]]]')
            // and parentheses keep a property reference, as JavaScript's do
            // — `(a.at)(0) === 42` there, pinned by `chainsJs.receiver` in
            // `fjs/edag/proof.f.mjs` — so a call on a grouped access is the
            // method call, the very node `o.b(1)` is and not a detached one
            const grouped = '[[],[["object",[[":","b",1]]],["object",[[":","default",["()",[".",["cref",0],"b"],[1]]]]]]]'
            expect('const o = { b: 1 }; export default (o.b)(1);', grouped)
            expect('const o = { b: 1 }; export default ((o.b))(1);', grouped)
            expect('const o = { b: 1 }; export default o.b(1);', grouped)
            // a step reads the value in the group and nothing else, so
            // parentheses around one add no tree: a numeric literal takes
            // its access and its call as it does without them
            expect('export default (1).x;', '[[],[["object",[[":","default",[".",1,"x"]]]]]]')
            expect('export default 1 .x;', '[[],[["object",[[":","default",[".",1,"x"]]]]]]')
            expect('export default (1)(2);', '[[],[["object",[[":","default",["()",1,[2]]]]]]]')
            expect('export default 1(2);', '[[],[["object",[[":","default",["()",1,[2]]]]]]]')
            // what a group does change is how far a prefix reaches, since
            // `-` binds looser than a step: `(-1).x` is the access on the
            // negation, which nothing else spells, and `-1 .x` the negation
            // of the access, as JavaScript reads each
            expect('export default (-1).x;', '[[],[["object",[[":","default",[".",["-",1],"x"]]]]]]')
            expect('export default -1 .x;', '[[],[["object",[[":","default",["-",[".",1,"x"]]]]]]]')
            // and the group is the `-`'s operand, the one way a function or
            // an access on a value written in place reaches a prefix
            expect('export default -(1);', '[[],[["object",[[":","default",["-",1]]]]]]')
            expect('export default -(1).x;', '[[],[["object",[[":","default",["-",[".",1,"x"]]]]]]]')
            expect('export default -((...a) => 1);', '[[],[["object",[[":","default",["-",["=>",0,[1]]]]]]]]')
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
            expect('const o = {}; export default o.toString(1);', '[[],[["object",[]],["object",[[":","default",["()",[".",["cref",0],"toString"],[1]]]]]]]')
            expect('const a = []; export default a["at"](0);', '[[],[["array",[]],["object",[[":","default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('const a = []; export default (a.at)(0);', '[[],[["array",[]],["object",[[":","default",["()",[".",["cref",0],"at"],[0]]]]]]]')
            expect('export default [1, 2].map(1).length;', '[[],[["object",[[":","default",[".",["()",[".",["array",[1,2]],"map"],[1]],"length"]]]]]]')
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
            expect('const f = (...a) => 1; const o = { length: f }; export default o.length();', '[[],[["=>",0,[1]],["object",[[":","length",["cref",0]]]],["object",[[":","default",["()",[".",["cref",1],"length"],[]]]]]]]')
            expect('const a = []; export default a.length(1);', '[[],[["array",[]],["object",[[":","default",["()",[".",["cref",0],"length"],[1]]]]]]]')
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
            expect('export default 1();', '[[],[["object",[[":","default",["()",1,[]]]]]]]')
            expect('export default -1();', '[[],[["object",[[":","default",["-",["()",1,[]]]]]]]]')
            expect('export default -1n();', '[[],[["object",[[":","default",["-",["()",1n,[]]]]]]]]')
            expect('export default -Infinity();', '[[],[["object",[[":","default",["-",["()",Infinity,[]]]]]]]]')
            // an argument is read as any other is, so its own error is the
            // one reported — there is no earlier one to come first
            const [tag, value] = parseFromTokens(tokenizeString('export default 1(zzz);'))
            assert(tag === 'error', tag)
            assertEq(value.message, 'const not found')
            assertEq(value.metadata?.column, 18)
            // and a reference to a number still reads alike in both
            expect('const n = 1; export default n();', '[[],[1,["object",[[":","default",["()",["cref",0],[]]]]]]]')
        },
        // A body `const` may take a name the module binds. The body cannot
        // reach the module's scope at all — a reference out is a capture —
        // so the module's name is unreachable here rather than hidden, and
        // no-shadowing (`spec/todo/3150-shadowing.md`) has nothing to
        // decide about this case.
        bodyConstShadowsModule: () => {
            const [tag, value] = parseFromTokens(tokenizeString('const c = 1; export default (...a) => { const c = 2; return c; };'))
            assert(tag === 'ok', value)
            assertEq(stringifyDjsModule(value), '[[],[1,["object",[[":","default",["=>",0,[2,["cref",0]]]]]]]]')
        },
        // A function that is the whole value of a `const` has the `const`'s
        // name in its body: a read of it that no parameter or body `const`
        // answers first is `['self']`, the function itself, where a `const`
        // is otherwise not in its own initializer's scope. A function
        // nested in it captures the name as it captures any value around
        // it, and a body `const`'s name reaches its function the same way.
        self: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            expect('const f = () => f(); export default f;', '[[],[["=>",0,[["()",["self"],[]]]],["object",[[":","default",["cref",0]]]]]]')
            expect(
                'const fact = n => n < 2 ? 1 : n * fact(n - 1); export default fact(5);',
                '[[],[["=>",1,[["?:",["<",["arg",0],2],1,["*",["arg",0],["()",["self"],[["-",["arg",0],1]]]]]]],["object",[[":","default",["()",["cref",0],[5]]]]]]]')
            // a nested function captures the name into a slot of its frame
            expect(
                'const f = x => () => f(x); export default f;',
                '[[],[["=>",1,[["=>",0,[["()",["fref",0],[["fref",1]]]],[["self"],["arg",0]]]]],["object",[[":","default",["cref",0]]]]]]')
            // the statements after a guard are a function of their own, and
            // capture the name through it
            expect(
                'const f = x => { if (x) { return f; } return 0; }; export default f;',
                '[[],[["=>",1,[["?:",["arg",0],["()",["=>",0,[["fref",0]],[["self"]]],[]],["()",["=>",0,[0]],[]]]]],["object",[[":","default",["cref",0]]]]]]')
            // a body `const`'s function has the name as a module `const`'s does
            expect(
                'export default () => { const step = n => n < 1 ? 0 : step(n - 1); return step(3); };',
                '[[],[["object",[[":","default",["=>",0,[["=>",1,[["?:",["<",["arg",0],1],0,["()",["self"],[["-",["arg",0],1]]]]]],["()",["cref",0],[3]]]]]]]]]')
            // a parameter of the name shadows it, as it does in JavaScript,
            // and so does a body `const` the body has not read it before
            expect('const f = f => f; export default f;', '[[],[["=>",1,[["arg",0]]],["object",[[":","default",["cref",0]]]]]]')
            expect('const f = () => { const f = 1; return f; }; export default f;', '[[],[["=>",0,[1,["cref",0]]],["object",[[":","default",["cref",0]]]]]]')
        },
        // Where the name does not reach the function: a `const` whose value
        // holds a function without being one, or calls one, is not in its
        // own initializer's scope — only the function itself is named. A
        // body `const` of the name after the body has read it is refused as
        // a capture shadowed is: JavaScript would have read the `const`
        // there, before its initializer ran.
        selfRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('const f = [() => f]; export default f;', 'const not found', 18)
            expect('const f = (() => f)(); export default f;', 'const not found', 18)
            expect('const f = () => { const g = f; const f = 1; return g; }; export default f;', 'capture shadowed', 38)
            expect('const f = () => { const f = f(); return f; }; export default f;', 'capture shadowed', 25)
            expect('const f = x => { if (x) { return f; } const f = 2; return f; }; export default f;', 'capture shadowed', 45)
            // a name nothing binds is as unbound as ever where there is no `const`
            expect('export default () => f;', 'const not found', 22)
        },
    },
    // The `entry` helper, recognized whole as the AST's `['entry']`: a
    // function of two parameters whose block body binds the descriptor
    // `Object.getOwnPropertyDescriptor` answers for them and returns the
    // value an enumerable one holds, under any three distinct names and
    // either key spelling, with or without its semicolons where JavaScript
    // inserts them, wherever a function stands.
    entry: {
        parsed: () => {
            /** @type {(source: string, expected: string) => void} */
            const expect = (source, expected) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), expected)
            }
            const helper = 'const entry = (a, b) => {\n    const x = Object.getOwnPropertyDescriptor(a, b);\n    return x?.enumerable ? x.value : undefined;\n};'
            expect(`${helper} export default entry;`, '[[],[["entry"],["object",[[":","default",["cref",0]]]]]]')
            expect(`${helper} export default entry({ k: 1 }, "k");`, '[[],[["entry"],["object",[[":","default",["()",["cref",0],[["object",[[":","k",1]]],"k"]]]]]]]')
            expect('export default (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; };', '[[],[["object",[[":","default",["entry"]]]]]]')
            // other names, the other key spellings, the semicolons omitted,
            // and nested in a function as any function may be
            expect('export default (o, p) => {\n const d = Object["getOwnPropertyDescriptor"](o, p)\n return d?.enumerable ? d["value"] : undefined\n}', '[[],[["object",[[":","default",["entry"]]]]]]')
            expect('export default () => (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; };', '[[],[["object",[[":","default",["=>",0,[["entry"]]]]]]]]')
        },
        // Not the helper: `Object` names what a scope binds — a `const`, a
        // parameter, the function's own name — and the function is the
        // ordinary function JavaScript reads it as; and a body that departs
        // from the helper's by a step is an ordinary function too, which is
        // where the `Object` nothing binds is refused as any unbound word is.
        notTheHelper: () => {
            /** @type {(source: string) => string} */
            const parsed = source => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                return stringifyDjsModule(value)
            }
            const body = '{ const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; }'
            for (const source of [
                `const Object = { getOwnPropertyDescriptor: (o, k) => o }; export default (a, b) => ${body};`,
                `export default (Object, b) => { const x = Object.getOwnPropertyDescriptor(Object, b); return x?.enumerable ? x.value : undefined; };`,
                `const Object = (a, b) => ${body}; export default Object;`,
            ]) {
                const tree = parsed(source)
                assert(!tree.includes('"entry"') && tree.includes('"=>",2'), tree)
            }
            /** @type {(source: string, message: string, column: number) => void} */
            const refused = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(`${value.message} at ${value.metadata?.column}`, `${message} at ${column}`, source)
            }
            for (const other of [
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : null; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(b, a); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.name : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value.y : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value?.() : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? 1 : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : x; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return a?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.writable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, a); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor; return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable() ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b, 1); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, ...b); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptors(a, b); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object(a, b); return x?.enumerable ? x.value : undefined; }',
                '(a, b, c) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; }',
                '(a, ...b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); const y = x; return x?.enumerable ? x.value : undefined; }',
                '(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); throw x?.enumerable ? x.value : undefined; }',
                '(a, b) => { if (a) { return b; } return Object.getOwnPropertyDescriptor(a, b); }',
                '(a, b) => Object.getOwnPropertyDescriptor(a, b);',
            ]) { refused(`export default ${other}`, 'const not found', 16 + other.indexOf('Object')) }
            refused('export default (a, b) => { const x = Reflect.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; };', 'const not found', 38)
            // a keyword or a repeated name among the three is refused as it
            // is in any function
            refused('export default (if, b) => { const x = Object.getOwnPropertyDescriptor(if, b); return x?.enumerable ? x.value : undefined; };', 'reserved word', 17)
            refused('export default (a, a) => { const x = Object.getOwnPropertyDescriptor(a, a); return x?.enumerable ? x.value : undefined; };', 'duplicate id', 20)
            refused('export default (a, b) => { const a = Object.getOwnPropertyDescriptor(a, b); return a?.enumerable ? a.value : undefined; };', 'duplicate id', 34)
            // and the line rules every block keeps: a statement without its
            // `;` ends at a newline, and `return` and its value share a line
            refused('export default (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b) return x?.enumerable ? x.value : undefined; };', 'unexpected token', 76)
            refused('export default (a, b) => {\n const x = Object.getOwnPropertyDescriptor(a, b);\n return\n x?.enumerable ? x.value : undefined;\n};', 'unexpected token', 2)
        },
    },
}
