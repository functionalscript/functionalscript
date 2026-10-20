/**
 * The proof of the parser's operators, the prefix `-` and Stage A and B of `spec/todo/2340-operators.md`, split off `./proof.f.mjs` when that file
 * outgrew what the website's build accepts in one file — 128 KiB, which it
 * passed at `e15e2ea` — along the seam its own sections drew. It reads the
 * parser as that proof does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { parseFromTokens } from './module.f.mjs'
import { stringifyDjsModule, tokenizeString } from './proof.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.js'

export const proof = {
    // The one prefix operator. `-` is a token the grammar reads, so what it
    // takes is a whole value with its steps — JavaScript's reading — and
    // what it may take is JavaScript's `UnaryExpression`: not an arrow
    // function, which is why `-(...a) => 1` is a syntax error in both.
    neg: {
        forms: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default -1;', '[[],[["object",[[":","default",["-",1]]]]]]')
            expect('export default -1n;', '[[],[["object",[[":","default",["-",1n]]]]]]')
            expect('export default -0;', '[[],[["object",[[":","default",["-",0]]]]]]')
            expect('export default -Infinity;', '[[],[["object",[[":","default",["-",Infinity]]]]]]')
            // `-NaN` is a value in JavaScript and is one here, where the
            // fold made it an error token
            expect('export default -NaN;', '[[],[["object",[[":","default",["-",NaN]]]]]]')
            expect('export default -"2";', '[[],[["object",[[":","default",["-","2"]]]]]]')
            expect('export default -[1];', '[[],[["object",[[":","default",["-",["array",[1]]]]]]]]')
            expect('export default -{a:1};', '[[],[["object",[[":","default",["-",["object",[[":","a",1]]]]]]]]]')
            // right-recursive, so a negation takes a negation
            expect('export default - -1;', '[[],[["object",[[":","default",["-",["-",1]]]]]]]')
            expect('export default - - -1;', '[[],[["object",[[":","default",["-",["-",["-",1]]]]]]]]')
            // and inside a body, where the prefix is the body's own value
            expect('export default (...a) => -a[0];', '[[],[["object",[[":","default",["=>",0,[["-",[".",["rest"],0]]]]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // `--` is the one decrement token, which the language has no
            // rule for, so it is refused where it is written and never read
            // as a negation of a negation — `- -1` is how that is spelled
            expect('export default --1;', 16)
            // an arrow function is no `UnaryExpression`: `-(...a) => 1` is a
            // syntax error in JavaScript, so the operand rule takes every
            // value but a function. The `(` is not what fails — a group
            // is an operand, `-((...a) => 1)` — so the refusal is at what
            // the `(` opens: the `...`, exactly where JavaScript's is, or
            // the `)` of an empty list, which is no value to group either
            expect('export default -(...a) => 1;', 18)
            expect('export default -() => 1;', 18)
            expect('export default !(...a) => 1;', 18)
            expect('export default typeof (...a) => 1;', 24)
            // and it is the *operand rule* that refuses it, not the one
            // branch: the rule names itself, so a `-` one deeper reaches it
            // again, and a body's `-` takes the same rule rather than the
            // body's own. Each of the three references is load-bearing —
            // point any of them at `value` and the function is admitted
            expect('export default - -(...a) => 1;', 20)
            expect('export default (...b) => -(...a) => 1;', 28)
            expect('export default (...b) => - -(...a) => 1;', 30)
        },
    },
    // Stage A of `spec/todo/2340-operators.md`: arithmetic, strict
    // comparison, and bitwise, each read as `[tag, left, right]` — the
    // binary `-` told from `neg`'s own unary one by length, `**`
    // right-associative, and every operator above `unary` — never a value
    // or a body themselves, the same reason `neg`'s operand rule refuses a
    // function above.
    operators: {
        forms: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            // arithmetic, left-associative, and its own precedence within
            expect('export default 1 + 2 * 3;', '[[],[["object",[[":","default",["+",1,["*",2,3]]]]]]]')
            expect('export default 1 * 2 + 3;', '[[],[["object",[[":","default",["+",["*",1,2],3]]]]]]')
            expect('export default 5 - 2 - 1;', '[[],[["object",[[":","default",["-",["-",5,2],1]]]]]]')
            expect('export default 6 / 4 / 2;', '[[],[["object",[[":","default",["/",["/",6,4],2]]]]]]')
            expect('export default 6 % 4 % 3;', '[[],[["object",[[":","default",["%",["%",6,4],3]]]]]]')
            // `**` right-associative, and above it in precedence
            expect('export default 2 ** 3 ** 2;', '[[],[["object",[[":","default",["**",2,["**",3,2]]]]]]]')
            // `**`'s own right operand reaches back into a full `unary`, so
            // a `-`/`~` stands there without parentheses, as it does in
            // JavaScript
            expect('export default 2 ** -2;', '[[],[["object",[[":","default",["**",2,["-",2]]]]]]]')
            expect('export default 2 ** ~2;', '[[],[["object",[[":","default",["**",2,["~",2]]]]]]]')
            expect('export default 2 ** - -2;', '[[],[["object",[[":","default",["**",2,["-",["-",2]]]]]]]]')
            // parentheses are the only way to raise a negation to a power,
            // or to negate one, matching JavaScript exactly
            expect('export default (-2) ** 2;', '[[],[["object",[[":","default",["**",["-",2],2]]]]]]')
            expect('export default -(2 ** 2);', '[[],[["object",[[":","default",["-",["**",2,2]]]]]]]')
            expect('export default ~1 & 2;', '[[],[["object",[[":","default",["&",["~",1],2]]]]]]')
            // `!` is the third prefix at the same level: bare as `**`'s right
            // operand, and a chain of prefixes is read inside out
            expect('export default !1 & 2;', '[[],[["object",[[":","default",["&",["!",1],2]]]]]]')
            expect('export default 2 ** !2;', '[[],[["object",[[":","default",["**",2,["!",2]]]]]]]')
            expect('export default !!1;', '[[],[["object",[[":","default",["!",["!",1]]]]]]]')
            expect('export default !-~1;', '[[],[["object",[[":","default",["!",["-",["~",1]]]]]]]]')
            // `typeof` is the fourth, a keyword with a symbol of its own
            expect('export default typeof 1 & 2;', '[[],[["object",[[":","default",["&",["typeof",1],2]]]]]]')
            expect('export default 2 ** typeof 2;', '[[],[["object",[[":","default",["**",2,["typeof",2]]]]]]]')
            expect('export default typeof typeof 1;', '[[],[["object",[[":","default",["typeof",["typeof",1]]]]]]]')
            expect('export default !typeof -1;', '[[],[["object",[[":","default",["!",["typeof",["-",1]]]]]]]]')
            // and a key or a property name still, as every keyword is
            expect('export default { typeof: 1 }.typeof;', '[[],[["object",[[":","default",[".",["object",[[":","typeof",1]]],"typeof"]]]]]]')
            // `instanceof Array` is a relational operator, one level with
            // `<`, left-associative; its right side is the name, not a
            // value, and a group around the name vanishes
            expect('export default [] instanceof Array;', '[[],[["object",[[":","default",["instanceof",["array",[]],"Array"]]]]]]')
            expect('export default [] instanceof (Array);', '[[],[["object",[[":","default",["instanceof",["array",[]],"Array"]]]]]]')
            expect('export default !1 instanceof Array;', '[[],[["object",[[":","default",["instanceof",["!",1],"Array"]]]]]]')
            expect('export default 1 < 2 instanceof Array === true;', '[[],[["object",[[":","default",["===",["instanceof",["<",1,2],"Array"],true]]]]]]')
            expect('export default [] instanceof Array instanceof Array;', '[[],[["object",[[":","default",["instanceof",["instanceof",["array",[]],"Array"],"Array"]]]]]]')
            expect('export default 1 | [] instanceof Array;', '[[],[["object",[[":","default",["|",1,["instanceof",["array",[]],"Array"]]]]]]]')
            expect('export default (...a) => a[0] instanceof Array && a;', '[[],[["object",[[":","default",["=>",0,[["&&",["instanceof",[".",["rest"],0],"Array"],["rest"]]]]]]]]]')
            // and a key or a property name, as every keyword is
            expect('export default { instanceof: 1 }.instanceof;', '[[],[["object",[[":","default",[".",["object",[[":","instanceof",1]]],"instanceof"]]]]]]')
            /**
             * The right operand is the one reference the language has a
             * meaning for: any other value is refused at the operator —
             * an unknown constructor, an access, a literal, a function —
             * where every spelling of the right side has a token.
             *
             * @type {(source: string, column: number) => void}
             */
            const refused = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'the right operand of instanceof must be Array')
                assertEq(value.metadata?.column, column)
            }
            refused('export default [] instanceof Map;', 19)
            refused('export default [] instanceof Array.prototype.constructor;', 19)
            refused('export default [] instanceof [];', 19)
            refused('export default [] instanceof 1;', 19)
            refused('export default [] instanceof ((...a) => a);', 19)
            refused('export default 1 < [] instanceof (Array)[0];', 23)
            // the left operand is resolved first, as every binary
            // operator's: with both sides wrong, the left's fault is the
            // one reported, the first in document order
            {
                const [tag, value] = parseFromTokens(tokenizeString('export default missing instanceof Map;'))
                assert(tag === 'error', tag)
                assertEq(value.message, 'const not found')
                assertEq(value.metadata?.column, 16)
            }
            // strict comparison and bitwise, in JavaScript's own precedence
            expect('export default 1 + 2 < 3 * 4;', '[[],[["object",[[":","default",["<",["+",1,2],["*",3,4]]]]]]]')
            expect('export default 1 <= 2 >= 1;', '[[],[["object",[[":","default",[">=",["<=",1,2],1]]]]]]')
            expect('export default 2 > 1;', '[[],[["object",[[":","default",[">",2,1]]]]]]')
            expect('export default 1 < 2 === 3 < 4;', '[[],[["object",[[":","default",["===",["<",1,2],["<",3,4]]]]]]]')
            expect('export default 1 !== 2 === (3 !== 4);', '[[],[["object",[[":","default",["===",["!==",1,2],["!==",3,4]]]]]]]')
            expect('export default 1 << 2 + 3;', '[[],[["object",[[":","default",["<<",1,["+",2,3]]]]]]]')
            expect('export default 256 >> 4 >> 1;', '[[],[["object",[[":","default",[">>",[">>",256,4],1]]]]]]')
            expect('export default -1 >>> 16 >>> 8;', '[[],[["object",[[":","default",[">>>",[">>>",["-",1],16],8]]]]]]')
            expect('export default 1 & 2 | 3 ^ 4;', '[[],[["object",[[":","default",["|",["&",1,2],["^",3,4]]]]]]]')
            // a group as an operand, and steps/power bound tighter than a layer
            expect('export default (1 + 2) * 3;', '[[],[["object",[[":","default",["*",["+",1,2],3]]]]]]')
            expect('const a = [1]; export default a[0] * 2;', '[[],[["array",[1]],["object",[[":","default",["*",[".",["cref",0],0],2]]]]]]')
            expect('export default 2 ** 2 * 3;', '[[],[["object",[[":","default",["*",["**",2,2],3]]]]]]')
            // a function's body is its own operand, the whole expression
            // its greedy operand rather than the outer layer's own
            expect('export default (...a) => 1 + 2 * 3;', '[[],[["object",[[":","default",["=>",0,[["+",1,["*",2,3]]]]]]]]]')
            // a group around a function is an ordinary operand once more
            expect('export default 1 * ((...a) => 2);', '[[],[["object",[[":","default",["*",1,["=>",0,[2]]]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // a function is no operand of a binary operator, unparenthesized:
            // an operand's own `(` is `unary`'s restricted one, a group
            // alone, so `...` is refused right there, one token earlier
            // than `neg`'s own — its operand rule takes `paren`, the
            // choice a function shares, and refuses at what its own body
            // cannot spell instead
            expect('export default 1 * (...a) => 2;', 21)
            // an empty group is no value either, refused at the `)`
            expect('export default 1 + () => 2;', 21)
            // JavaScript refuses `**` immediately after a unary-prefixed
            // operand, full stop — no reading admitted without parentheses
            // — so `unaryOperand` carries no `powTail` of its own, at any
            // depth of `-`/`~` nesting, whether the operand is bare or
            // itself parenthesized
            expect('export default -2 ** 2;', 19)
            expect('export default ~2 ** 2;', 19)
            expect('export default - -2 ** 2;', 21)
            expect('export default ~ ~2 ** 2;', 21)
            expect('export default !2 ** 2;', 19)
            expect('export default !!2 ** 2;', 20)
            expect('export default typeof 2 ** 2;', 25)
            expect('export default - (2) ** 2;', 22)
            // the same restriction recurses through `**`'s own right
            // operand: `2 ** -2 ** 2` reads its own right side as an
            // exponentiation in turn, and `-2 ** 2` refuses there exactly
            // as it does standing alone
            expect('export default 2 ** -2 ** 2;', 24)
        },
        scope: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            // both operands are resolved, in order
            expect('export default 1 + zzz;', 'const not found', 20)
            expect('export default zzz + 1;', 'const not found', 16)
        },
        // Stage B: the lazy operators, `[tag, left, right]` exactly as the
        // eager ones are — laziness is no shape difference here — above
        // `bitwiseOr`, `&&` below `||`, and `??` a chain of its own that
        // mixes with neither, refused at the operator that would mix them.
        lazy: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1 && 2;', '[[],[["object",[[":","default",["&&",1,2]]]]]]')
            expect('export default 1 || 2;', '[[],[["object",[[":","default",["||",1,2]]]]]]')
            expect('export default 1 ?? 2;', '[[],[["object",[[":","default",["??",1,2]]]]]]')
            // left-associative, each of them
            expect('export default 1 && 2 && 3;', '[[],[["object",[[":","default",["&&",["&&",1,2],3]]]]]]')
            expect('export default 1 || 2 || 3;', '[[],[["object",[[":","default",["||",["||",1,2],3]]]]]]')
            expect('export default 1 ?? 2 ?? 3;', '[[],[["object",[[":","default",["??",["??",1,2],3]]]]]]')
            // `&&` binds tighter than `||`, whichever opens the chain
            expect('export default 1 || 2 && 3;', '[[],[["object",[[":","default",["||",1,["&&",2,3]]]]]]]')
            expect('export default 1 && 2 || 3;', '[[],[["object",[[":","default",["||",["&&",1,2],3]]]]]]')
            expect('export default 1 && 2 || 3 && 4 || 5;', '[[],[["object",[[":","default",["||",["||",["&&",1,2],["&&",3,4]],5]]]]]]')
            expect('export default 1 || 2 && 3 && 4 || 5 && 6;', '[[],[["object",[[":","default",["||",["||",1,["&&",["&&",2,3],4]],["&&",5,6]]]]]]]')
            // and every eager operator binds tighter than any of them
            expect('export default 1 | 2 && 3 + 4;', '[[],[["object",[[":","default",["&&",["|",1,2],["+",3,4]]]]]]]')
            expect('export default 1 === 2 ?? 3 ** 4;', '[[],[["object",[[":","default",["??",["===",1,2],["**",3,4]]]]]]]')
            expect('export default -1 || ~2;', '[[],[["object",[[":","default",["||",["-",1],["~",2]]]]]]]')
            // a group is an operand, and mixes what the bare chain may not
            expect('export default (1 ?? 2) || 3;', '[[],[["object",[[":","default",["||",["??",1,2],3]]]]]]')
            expect('export default 1 ?? (2 || 3);', '[[],[["object",[[":","default",["??",1,["||",2,3]]]]]]]')
            expect('export default (1 && 2).x;', '[[],[["object",[[":","default",[".",["&&",1,2],"x"]]]]]]')
            // a function's body is its own operand, the whole chain
            expect('export default (...a) => a && 1 || 2;', '[[],[["object",[[":","default",["=>",0,[["||",["&&",["rest"],1],2]]]]]]]]')
            expect('export default 1 && ((...a) => 2);', '[[],[["object",[[":","default",["&&",1,["=>",0,[2]]]]]]]]')
        },
        lazyRefused: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // `??` beside `&&`/`||` at one nesting is a syntax error in
            // JavaScript, not a precedence question, and the grammar's
            // shape refuses it at the second operator: a chain committed to
            // one has no round for the other
            expect('export default 1 ?? 2 || 3;', 23)
            expect('export default 1 ?? 2 && 3;', 23)
            expect('export default 1 && 2 ?? 3;', 23)
            expect('export default 1 || 2 ?? 3;', 23)
            expect('export default 1 || 2 && 3 ?? 4;', 28)
            // a function is no operand of a lazy operator unparenthesized,
            // as of no eager one
            expect('export default 1 && (...a) => 2;', 22)
        },
        // The conditional, `['?:', condition, then, else]` — the one node
        // of three operands, above the short-circuit level, its arms whole
        // values, so a nested conditional associates to the right.
        conditional: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default 1 ? 2 : 3;', '[[],[["object",[[":","default",["?:",1,2,3]]]]]]')
            expect('export default 1?2:3;', '[[],[["object",[[":","default",["?:",1,2,3]]]]]]')
            expect('export default 1 ? 2 : 3 ? 4 : 5;', '[[],[["object",[[":","default",["?:",1,2,["?:",3,4,5]]]]]]]')
            expect('export default 1 ? 2 ? 3 : 4 : 5;', '[[],[["object",[[":","default",["?:",1,["?:",2,3,4],5]]]]]]')
            // the condition is the whole short-circuit chain, and each arm
            // takes one of its own
            expect('export default 1 && 2 ? 3 || 4 : 5 ?? 6;', '[[],[["object",[[":","default",["?:",["&&",1,2],["||",3,4],["??",5,6]]]]]]]')
            expect('export default 1 + 2 ? 3 : 4;', '[[],[["object",[[":","default",["?:",["+",1,2],3,4]]]]]]')
            // an arm may be a function, its body ending where `:` cannot
            // continue it — `1 ? () => 2 : 3` is the function and the else
            // arm, as JavaScript reads it — or an object, an array, a group
            expect('export default 1 ? () => 2 : 3;', '[[],[["object",[[":","default",["?:",1,["=>",0,[2]],3]]]]]]')
            expect('export default 1 ? 2 : () => 3 ? 4 : 5;', '[[],[["object",[[":","default",["?:",1,2,["=>",0,[["?:",3,4,5]]]]]]]]]')
            expect('export default 1 ? { x: 2 } : [3];', '[[],[["object",[[":","default",["?:",1,["object",[[":","x",2]]],["array",[3]]]]]]]]')
            expect('export default (1 ? 2 : 3).x;', '[[],[["object",[[":","default",[".",["?:",1,2,3],"x"]]]]]]')
            expect('export default [1 ? 2 : 3, { a: 4 ? 5 : 6 }];', '[[],[["object",[[":","default",["array",[["?:",1,2,3],["object",[[":","a",["?:",4,5,6]]]]]]]]]]]')
            expect('export default (...a) => a ? 1 : 2;', '[[],[["object",[[":","default",["=>",0,[["?:",["rest"],1,2]]]]]]]]')
            expect('export default -1 ? -2 : ~3;', '[[],[["object",[[":","default",["?:",["-",1],["-",2],["~",3]]]]]]]')
            // three operands, resolved in order: the condition first, then
            // each arm, whether or not the program establishes it
            expect('const a = 1; export default a ? a : a;', '[[],[1,["object",[[":","default",["?:",["cref",0],["cref",0],["cref",0]]]]]]]')
        },
        conditionalRefused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            expect('export default 1 ? 2;', 'unexpected token', 21)
            expect('export default 1 ? : 3;', 'unexpected token', 20)
            expect('export default 1 ? 2 : 3 : 4;', 'unexpected token', 26)
            // every operand is resolved, an unselected arm included: a name
            // is checked where it is written, as JavaScript's early errors are
            expect('export default zzz ? 1 : 2;', 'const not found', 16)
            expect('export default 1 ? zzz : 2;', 'const not found', 20)
            expect('export default 1 ? 2 : zzz;', 'const not found', 24)
            expect('export default 1 && zzz;', 'const not found', 21)
            expect('export default zzz ?? 1;', 'const not found', 16)
        },
    },
    // Operators JavaScript has and the language refuses *by design*, not for
    // want of work: the specification names each and the reason
    // (`spec/todo/2346-in-operator.md`, `spec/todo/2340-operators.md`). A
    // refusal is pinned as an accepted form is, with the message and the
    // column it is reported at, so that admitting one by accident, or moving
    // its error, fails a proof.
    // The comma operator, in parentheses (`spec/operators/comma.md`): every
    // operand kept, in order, as written — which ones the graph anchors is
    // the lowering's to say. A list in parentheses is a comma where no `=>`
    // follows its `)` and a function's parameters where one does.
    comma: {
        forms: () => {
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default (1, 2);', '[[],[["object",[[":","default",[",",[1,2]]]]]]]')
            expect('export default (1, 2, 3);', '[[],[["object",[[":","default",[",",[1,2,3]]]]]]]')
            // a comma nests as written, in either operand
            expect('export default ((1, 2), 3);', '[[],[["object",[[":","default",[",",[[",",[1,2]],3]]]]]]]')
            expect('export default (1, (2, 3));', '[[],[["object",[[":","default",[",",[1,[",",[2,3]]]]]]]]]')
            // a group of it takes steps, a prefix and an operator's place
            expect('export default (1, 2).x;', '[[],[["object",[[":","default",[".",[",",[1,2]],"x"]]]]]]')
            expect('export default -(1, 2);', '[[],[["object",[[":","default",["-",[",",[1,2]]]]]]]]')
            expect('export default 1 + (2, 3) * 4;', '[[],[["object",[[":","default",["+",1,["*",[",",[2,3]],4]]]]]]]')
            // `=>` after the `)` makes the same list parameters
            expect('export default (a, b) => a;', '[[],[["object",[[":","default",["=>",2,[["arg",0]]]]]]]]')
            expect('export default (a, b) => (a, b);', '[[],[["object",[[":","default",["=>",2,[[",",[["arg",0],["arg",1]]]]]]]]]]')
            // a comma as the callee is no access: the call is the plain one,
            // where a group keeps the method call
            expect('const o = { f: 1 }; export default (0, o.f)(1);', '[[],[["object",[[":","f",1]]],["object",[[":","default",["()",[",",[0,[".",["cref",0],"f"]]],[1]]]]]]]')
            expect('const o = { f: 1 }; export default (o.f)(1);', '[[],[["object",[[":","f",1]]],["object",[[":","default",["()",[".",["cref",0],"f"],[1]]]]]]]')
        },
        refused: () => {
            /** @type {(source: string, message: string, column: number) => void} */
            const expect = (source, message, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, message)
                assertEq(value.metadata?.column, column)
            }
            // what only a parameter list holds, where no `=>` follows: a
            // default at its `=`, a rest at its `...`, and a trailing comma
            // at the `)`, the first of them in the list
            expect('export default (a, b = 1);', 'unexpected token', 22)
            expect('export default (a, b = 1, c);', 'unexpected token', 22)
            expect('export default (a, ...b);', 'unexpected token', 20)
            expect('export default (a, b,);', 'unexpected token', 22)
            expect('export default (a,);', 'unexpected token', 19)
            // where `=>` follows, an item that is no binding target, at it
            expect('export default (a, b + 1) => 1;', 'invalid destructuring target', 20)
            expect('export default (a, (b)) => 1;', 'invalid destructuring target', 20)
            // an operand is a read: a prototype's member is refused by the
            // read rule, the comma's callee being no method's
            expect('export default (0, [].at)(0);', 'prohibited property name', 23)
            // each operand is resolved, in order
            expect('export default (missing, 1);', 'const not found', 17)
            expect('export default (1, missing);', 'const not found', 20)
            // a comma JavaScript reads with no parentheses of its own is
            // refused at it (`op.comma`), as JavaScript's own errors are
            expect('export default (...a) => { return a, a; };', 'unexpected token', 36)
            expect('export default 1, 2;', 'unexpected token', 17)
        },
    },
    refusedByDesign: {
        in: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            // the operator, at the `in`, whatever stands either side of it:
            // a literal key and an object, an array, a name, an element of
            // the arguments, inside a body
            expect('export default "a" in {};', 20)
            expect('export default 1 in [];', 18)
            expect('const o = { a: 1 }; export default "a" in o;', 40)
            expect('export default (...a) => "a" in a[0];', 30)
            // with the right operand missing, the refusal is still at the
            // `in`: it is the token no rule takes, not a half-formed
            // expression
            expect('export default "a" in;', 20)
            // `for (k in o)` is the other place JavaScript uses the word, a
            // statement the language has no rule for. It is refused at the
            // `for`, which says nothing about the operator.
            expect('export default (...a) => { for (const k in a) { return k } };', 28)
            expect('for (const k in {}) {}\nexport default 1;', 1)
        },
        // `in` is reserved, so it names no binding, but it stays a key and a
        // property name as every reserved word does: the refusal is of the
        // operator and not of the word
        inAsAName: () => {
            const [tag, value] = parseFromTokens(tokenizeString('const in = 1; export default in;'))
            assert(tag === 'error', tag)
            assertEq(value.message, 'reserved word')
            assertEq(value.metadata?.column, 7)
            // an `in` with nothing to its left is read as a name, which a
            // reserved word cannot be: refused as the word, at the `in`
            {
                const [tag, value] = parseFromTokens(tokenizeString('export default in;'))
                assert(tag === 'error', tag)
                assertEq(value.message, 'reserved word')
                assertEq(value.metadata?.column, 16)
            }
            /** @type {(source: string, ast: string) => void} */
            const expect = (source, ast) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'ok', value)
                assertEq(stringifyDjsModule(value), ast)
            }
            expect('export default { in: 1 };', '[[],[["object",[[":","default",["object",[[":","in",1]]]]]]]]')
        },
        // `==` and `!=` are refused too, since neither language reads them
        // the same way twice (`spec/operators/README.md`), at the operator
        looseEquality: () => {
            /** @type {(source: string, column: number) => void} */
            const expect = (source, column) => {
                const [tag, value] = parseFromTokens(tokenizeString(source))
                assert(tag === 'error', tag)
                assertEq(value.message, 'unexpected token')
                assertEq(value.metadata?.column, column)
            }
            expect('export default 1 == 1;', 18)
            expect('export default 1 != 1;', 18)
            expect('export default 1 == ;', 18)
        },
    },
}
