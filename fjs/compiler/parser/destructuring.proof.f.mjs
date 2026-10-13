/**
 * The proof of the parser's destructuring — binding patterns in `const`, a
 * module's, a body's and a loop block's — split off `./proof.f.mjs` when
 * that file outgrew what the website's build accepts in one file — 128 KiB,
 * which it passed at `37cd4b33` — along the seam its own section drew, as
 * `./func.proof.f.mjs` was. It reads the parser as that proof does,
 * through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { parseFromTokens } from './module.f.mjs'
import { expectModule, expectRefused, tokenizeString } from './proof.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    // A `const` of a binding pattern, `const { a, b: [c] } = v;`: the fold
    // writes the reads the pattern is sugar for — a hidden entry per source,
    // the initializer first, and one entry per name, each a `cref` of it —
    // and binds every name as a `const`'s
    // (spec/README.md#destructuring).
    destructuring: {
        module: () => {
            // an object pattern's property is an access of the hidden entry,
            // the shorthand and the string key alike; an array pattern is a
            // hidden spread of its source and an access per element
            expectModule('const { a, "%": [c, d] } = { a: null, "%": [true, false] }; export default [a, c, d];',
                '[[],[["object",[[":","a",null],[":","%",["array",[true,false]]]]],[".",["cref",0],"a"],["array",[["...",[".",["cref",0],"%"]]]],[".",["cref",2],0],[".",["cref",2],1],["object",[[":","default",["array",[["cref",1],["cref",3],["cref",4]]]]]]]]')
            // a nested pattern reads through a hidden entry of its own
            expectModule('const o = { a: { b: 1 } }; const { a: { b } } = o; export default b;',
                '[[],[["object",[[":","a",["object",[[":","b",1]]]]]],["cref",0],[".",["cref",1],"a"],[".",["cref",2],"b"],["object",[[":","default",["cref",3]]]]]]')
            expectModule('const x = [1]; const [a] = x; export default a;',
                '[[],[["array",[1]],["array",[["...",["cref",0]]]],[".",["cref",1],0],["object",[[":","default",["cref",2]]]]]]')
            // `length` is the one prototype name an access reads, so a pattern reads it
            expectModule('const { length } = "abc"; export default length;', '[[],["abc",[".",["cref",0],"length"],["object",[[":","default",["cref",1]]]]]]')
            // an empty pattern binds nothing and keeps its failure: the spread
            // of the source alone, and one read of the source's `length`
            expectModule('const x = {}; const {} = x; const [] = x; export default 1;',
                '[[],[["object",[]],["cref",0],[".",["cref",1],"length"],["array",[["...",["cref",0]]]],["object",[[":","default",1]]]]]')
            // a literal alone in the brackets is the constant key an access
            // admits in brackets, by its spelling: `[1.0]` names `1`
            expectModule('const o = { "3": 1, a: 2 }; const { [3]: x, ["a"]: y, [1.0]: z } = o; export default [x, y, z];',
                '[[],[["object",[[":","3",1],[":","a",2]]],["cref",0],[".",["cref",1],3],[".",["cref",1],"a"],[".",["cref",1],1],["object",[[":","default",["array",[["cref",2],["cref",3],["cref",4]]]]]]]]')
            // a trailing comma, as the literals allow one; an exported
            // pattern exports each of its names, and the hidden entry none
            expectModule('export const { a, b, } = { a: 1, b: 2 };',
                '[[],[["object",[[":","a",1],[":","b",2]]],[".",["cref",0],"a"],[".",["cref",0],"b"],["object",[[":","a",["cref",1]],[":","b",["cref",2]]]]]]')
            expectModule('const x = {}; const [a] = x; const { b } = x\nexport default [a, b];',
                '[[],[["object",[]],["array",[["...",["cref",0]]]],[".",["cref",1],0],["cref",0],[".",["cref",3],"b"],["object",[[":","default",["array",[["cref",2],["cref",4]]]]]]]]')
        },
        body: () => {
            // a body's entries are numbered by the entries before them, not
            // by the statements: one pattern makes several
            expectModule('const f = (...r) => { const [x, y] = r; const z = 1; return [y, x, z]; }; export default f;',
                '[[],[["=>",0,[["array",[["...",["rest"]]]],[".",["cref",0],0],[".",["cref",0],1],1,["array",[["cref",2],["cref",1],["cref",3]]]]],["object",[[":","default",["cref",0]]]]]]')
            expectModule('const f = () => { const [a] = [1]; return a; }; export default f;',
                '[[],[["=>",0,[["array",[["...",["array",[1]]]]],[".",["cref",0],0],["cref",1]]],["object",[[":","default",["cref",0]]]]]]')
            // in a loop's block, the body of a function of its own, whose
            // entries are counted as a body's are
            expectModule('export default n => { let r = 0; while (r < n) { const { d, e: [f] } = { d: 1, e: [2] }; r = r + d + f; } return r; };',
                '[[],[["object",[[":","default",["=>",1,[["()",["=>",1,[["?:",["<",["arg",0],["fref",0]],["()",["=>",0,[["object",[[":","d",1],[":","e",["array",[2]]]]],[".",["cref",0],"d"],["array",[["...",[".",["cref",0],"e"]]]],[".",["cref",2],0],["+",["+",["fref",0],["cref",1]],["cref",3]],["()",["fref",1],[["cref",4]]]],[["arg",0],["self"]]],[]],["arg",0]]],[["arg",0]]],[0]],["cref",0]]]]]]]]')
            // in a guard's arms, each its own body
            expectModule('const f = (...r) => { if (r[0]) { const [a] = r; return a; } const [b] = r; return b; }; export default f;',
                '[[],[["=>",0,[["?:",[".",["rest"],0],["()",["=>",0,[["array",[["...",["fref",0]]]],[".",["cref",0],0],["cref",1]],[["rest"]]],[]],["()",["=>",0,[["array",[["...",["fref",0]]]],[".",["cref",0],0],["cref",1]],[["rest"]]],[]]]]],["object",[[":","default",["cref",0]]]]]]')
        },
        // A pattern names no function as its whole value, so no name in it
        // is the function's own; and the `entry` helper is recognized whole,
        // so a pattern where its one `const` stands makes it an ordinary
        // function, in which `Object` is a name nothing binds.
        noSelf: () => {
            expectRefused('const { a: f } = { a: () => f }; export default f;', 'const not found', 29)
            expectRefused('export default (a, b) => { const { x } = Object.getOwnPropertyDescriptor(a, b); return x; };', 'const not found', 42)
        },
        // A value in a binding position is JavaScript's early error, at the
        // token it begins with: a literal, an access, a call, a prefix, a
        // template, a stepped literal, a function — and a group, which
        // JavaScript admits in an assignment pattern and refuses in a binding
        // one, at its `(`.
        invalidTarget: () => {
            expectRefused('const x = {}; const { a: 1 } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: b.c } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: f() } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: -b } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: `t` } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: [b].length } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = {}; const { a: b => b } = x; export default 1;', 'invalid destructuring target', 26)
            expectRefused('const x = []; const [(a)] = x; export default 1;', 'invalid destructuring target', 22)
            expectRefused('const x = {}; const { a: [b, (c)] } = x; export default 1;', 'invalid destructuring target', 30)
            expectRefused('export default () => { const { x: 1 } = {}; return 1; };', 'invalid destructuring target', 35)
        },
        // What the language does not read yet, refused by name: a rest
        // element at its `...`, a computed
        // key at the token it begins with, the conversion included
        // (spec/todo/2450-destructuring.md).
        unsupported: () => {
            expectRefused('const x = []; const [a, ...r] = x; export default 1;', 'rest element not supported', 25)
            expectRefused('const x = {}; const { a, ...r } = x; export default 1;', 'rest element not supported', 26)
            expectRefused('export default () => { const [a, ...r] = [1]; return a; };', 'rest element not supported', 34)
            expectRefused('const x = {}; const k = 1; const { [k]: a } = x; export default 1;', 'computed key in a binding pattern not supported', 37)
            expectRefused('const x = {}; const { [Number(1)]: a } = x; export default 1;', 'computed key in a binding pattern not supported', 24)
            // a grouped or a signed literal is no constant, as `o[(3)]` and
            // `o[-1]` are none; a constant one is checked as any key is
            expectRefused('const x = {}; const { [(3)]: a } = x; export default 1;', 'computed key in a binding pattern not supported', 24)
            expectRefused('const x = {}; const { [-1]: a } = x; export default 1;', 'computed key in a binding pattern not supported', 24)
            expectRefused('const x = {}; const { ["toString"]: a } = x; export default 1;', 'prohibited property name', 24)
            // a default is no literal, so the grammar stops at its `=`; an
            // elision is no array of this language
            expectRefused('const x = []; const [a = 1] = x; export default 1;', 'unexpected token', 24)
            expectRefused('const x = {}; const { a = 1 } = x; export default 1;', 'unexpected token', 25)
            expectRefused('const x = []; const [a, , b] = x; export default 1;', 'unexpected token', 25)
        },
        // The walk is one over an explicit stack, so a pattern as deep as
        // the lazy operators' bar costs no call stack, and its names are
        // collected as lists against an environment, so one as wide as that
        // bar costs its width — the two shapes the resolution's own stack
        // and `containerStackCost` already hold a value to.
        stackCost: () => {
            const deep = `const x = []; const ${'['.repeat(20000)}a${']'.repeat(20000)} = x; export default a;`
            assertEq(parseFromTokens(tokenizeString(deep))[0], 'ok')
            const wide = `const x = {}; const { ${Array.from({ length: 20000 }, (_, i) => `a${i}`).join(', ')} } = x; export default a0;`
            assertEq(parseFromTokens(tokenizeString(wide))[0], 'ok')
        },
        // A name in a pattern is a binding by every rule a `const`'s name
        // follows: reserved, bound twice — in the pattern itself, against
        // the module, against a parameter — exported as `then`, or shadowing
        // a capture; and a key is an access's, refusing a prototype's name.
        names: () => {
            expectRefused('const x = {}; const { if } = x; export default 1;', 'reserved word', 23)
            expectRefused('const x = {}; const { NaN } = x; export default 1;', 'reserved word', 23)
            expectRefused('const x = {}; const { a, b: a } = x; export default 1;', 'duplicate id', 29)
            expectRefused('const a = 1; const { a } = {}; export default 1;', 'duplicate id', 22)
            expectRefused('export default (y) => { const { y } = {}; return y; };', 'duplicate id', 33)
            expectRefused('export default (y) => { const [y] = []; return y; };', 'duplicate id', 32)
            expectRefused('export default () => { const [a, a] = []; return a; };', 'duplicate id', 34)
            expectRefused('export const { then } = {}; export default 1;', 'reserved export name then', 16)
            // an exported pattern exports the names it binds: none, and the
            // module exports nothing, which the grammar's `export` no longer
            // rules out — refused at the last `export`, unless a name or the
            // default follows
            expectRefused('export const {} = {};', 'module exports nothing', 1)
            expectRefused('const x = []; export const [] = x; export const {} = x;', 'module exports nothing', 36)
            expectModule('export const {} = {}; export default 1;', '[[],[["object",[]],[".",["cref",0],"length"],["object",[[":","default",1]]]]]')
            expectModule('export const [] = []; export const a = 1;', '[[],[["array",[["...",["array",[]]]]],1,["object",[[":","a",["cref",1]]]]]]')
            expectRefused('const x = {}; const { toString } = x; export default 1;', 'prohibited property name', 23)
            expectRefused('const x = {}; const { __proto__: p } = x; export default 1;', 'prohibited property name', 23)
            // the initializer read the name from outside, and the pattern
            // then binds it: `capture shadowed`, as for a name alone — in a
            // loop's block as in a body
            expectRefused('const a = [1]; export default () => { const { a } = a; return a; };', 'capture shadowed', 47)
            expectRefused('const d = { d: 1 }; export default n => { let r = 0; while (r < n) { const { d } = d; r = 1; } return r; };', 'capture shadowed', 78)
            // a loop's block may not bind the loop's variable, in a pattern
            // as by name
            expectRefused('export default n => { let r = 0; while (r < n) { const [r] = [1]; } return r; };', 'loop variable shadowed', 57)
            expectRefused('export default n => { let r = 0; while (r < n) { const { a: [r] } = {}; } return r; };', 'loop variable shadowed', 62)
            // and the module's `Object`, read as the intrinsic by an `entry`
            // helper, bound after by a pattern
            expectRefused('const e = (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; }; const { Object } = {}; export default e;', 'capture shadowed', 127)
            // the statement before it, written without its `;`, still ends
            // at a newline and not at a pattern on the same line
            expectRefused('const x = {}; const [a] = x const { b } = x; export default [a, b];', 'unexpected token', 29)
        },
    },
}
