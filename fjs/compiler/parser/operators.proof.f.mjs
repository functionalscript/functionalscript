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
import { assert, assertEq } from '../../asserts/module.f.mjs'

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
            expect('export default -1;', '[[],[["object",[["default",["-",1]]]]]]')
            expect('export default -1n;', '[[],[["object",[["default",["-",1n]]]]]]')
            expect('export default -0;', '[[],[["object",[["default",["-",0]]]]]]')
            expect('export default -Infinity;', '[[],[["object",[["default",["-",Infinity]]]]]]')
            // `-NaN` is a value in JavaScript and is one here, where the
            // fold made it an error token
            expect('export default -NaN;', '[[],[["object",[["default",["-",NaN]]]]]]')
            expect('export default -"2";', '[[],[["object",[["default",["-","2"]]]]]]')
            expect('export default -[1];', '[[],[["object",[["default",["-",["array",[1]]]]]]]]')
            expect('export default -{a:1};', '[[],[["object",[["default",["-",["object",[["a",1]]]]]]]]]')
            // right-recursive, so a negation takes a negation
            expect('export default - -1;', '[[],[["object",[["default",["-",["-",1]]]]]]]')
            expect('export default - - -1;', '[[],[["object",[["default",["-",["-",["-",1]]]]]]]]')
            // and inside a body, where the prefix is the body's own value
            expect('export default (...a) => -a[0];', '[[],[["object",[["default",["=>",0,[["-",[".",["rest"],0]]]]]]]]]')
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
            expect('export default 1 + 2 * 3;', '[[],[["object",[["default",["+",1,["*",2,3]]]]]]]')
            expect('export default 1 * 2 + 3;', '[[],[["object",[["default",["+",["*",1,2],3]]]]]]')
            expect('export default 5 - 2 - 1;', '[[],[["object",[["default",["-",["-",5,2],1]]]]]]')
            expect('export default 6 / 4 / 2;', '[[],[["object",[["default",["/",["/",6,4],2]]]]]]')
            expect('export default 6 % 4 % 3;', '[[],[["object",[["default",["%",["%",6,4],3]]]]]]')
            // `**` right-associative, and above it in precedence
            expect('export default 2 ** 3 ** 2;', '[[],[["object",[["default",["**",2,["**",3,2]]]]]]]')
            // `**`'s own right operand reaches back into a full `unary`, so
            // a `-`/`~` stands there without parentheses, as it does in
            // JavaScript
            expect('export default 2 ** -2;', '[[],[["object",[["default",["**",2,["-",2]]]]]]]')
            expect('export default 2 ** ~2;', '[[],[["object",[["default",["**",2,["~",2]]]]]]]')
            expect('export default 2 ** - -2;', '[[],[["object",[["default",["**",2,["-",["-",2]]]]]]]]')
            // parentheses are the only way to raise a negation to a power,
            // or to negate one, matching JavaScript exactly
            expect('export default (-2) ** 2;', '[[],[["object",[["default",["**",["-",2],2]]]]]]')
            expect('export default -(2 ** 2);', '[[],[["object",[["default",["-",["**",2,2]]]]]]]')
            expect('export default ~1 & 2;', '[[],[["object",[["default",["&",["~",1],2]]]]]]')
            // strict comparison and bitwise, in JavaScript's own precedence
            expect('export default 1 + 2 < 3 * 4;', '[[],[["object",[["default",["<",["+",1,2],["*",3,4]]]]]]]')
            expect('export default 1 <= 2 >= 1;', '[[],[["object",[["default",[">=",["<=",1,2],1]]]]]]')
            expect('export default 2 > 1;', '[[],[["object",[["default",[">",2,1]]]]]]')
            expect('export default 1 < 2 === 3 < 4;', '[[],[["object",[["default",["===",["<",1,2],["<",3,4]]]]]]]')
            expect('export default 1 !== 2 === (3 !== 4);', '[[],[["object",[["default",["===",["!==",1,2],["!==",3,4]]]]]]]')
            expect('export default 1 << 2 + 3;', '[[],[["object",[["default",["<<",1,["+",2,3]]]]]]]')
            expect('export default 256 >> 4 >> 1;', '[[],[["object",[["default",[">>",[">>",256,4],1]]]]]]')
            expect('export default -1 >>> 16 >>> 8;', '[[],[["object",[["default",[">>>",[">>>",["-",1],16],8]]]]]]')
            expect('export default 1 & 2 | 3 ^ 4;', '[[],[["object",[["default",["|",["&",1,2],["^",3,4]]]]]]]')
            // a group as an operand, and steps/power bound tighter than a layer
            expect('export default (1 + 2) * 3;', '[[],[["object",[["default",["*",["+",1,2],3]]]]]]')
            expect('const a = [1]; export default a[0] * 2;', '[[],[["array",[1]],["object",[["default",["*",[".",["cref",0],0],2]]]]]]')
            expect('export default 2 ** 2 * 3;', '[[],[["object",[["default",["*",["**",2,2],3]]]]]]')
            // a function's body is its own operand, the whole expression
            // its greedy operand rather than the outer layer's own
            expect('export default (...a) => 1 + 2 * 3;', '[[],[["object",[["default",["=>",0,[["+",1,["*",2,3]]]]]]]]]')
            // a group around a function is an ordinary operand once more
            expect('export default 1 * ((...a) => 2);', '[[],[["object",[["default",["*",1,["=>",0,[2]]]]]]]]')
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
            expect('export default 1 && 2;', '[[],[["object",[["default",["&&",1,2]]]]]]')
            expect('export default 1 || 2;', '[[],[["object",[["default",["||",1,2]]]]]]')
            expect('export default 1 ?? 2;', '[[],[["object",[["default",["??",1,2]]]]]]')
            // left-associative, each of them
            expect('export default 1 && 2 && 3;', '[[],[["object",[["default",["&&",["&&",1,2],3]]]]]]')
            expect('export default 1 || 2 || 3;', '[[],[["object",[["default",["||",["||",1,2],3]]]]]]')
            expect('export default 1 ?? 2 ?? 3;', '[[],[["object",[["default",["??",["??",1,2],3]]]]]]')
            // `&&` binds tighter than `||`, whichever opens the chain
            expect('export default 1 || 2 && 3;', '[[],[["object",[["default",["||",1,["&&",2,3]]]]]]]')
            expect('export default 1 && 2 || 3;', '[[],[["object",[["default",["||",["&&",1,2],3]]]]]]')
            expect('export default 1 && 2 || 3 && 4 || 5;', '[[],[["object",[["default",["||",["||",["&&",1,2],["&&",3,4]],5]]]]]]')
            expect('export default 1 || 2 && 3 && 4 || 5 && 6;', '[[],[["object",[["default",["||",["||",1,["&&",["&&",2,3],4]],["&&",5,6]]]]]]]')
            // and every eager operator binds tighter than any of them
            expect('export default 1 | 2 && 3 + 4;', '[[],[["object",[["default",["&&",["|",1,2],["+",3,4]]]]]]]')
            expect('export default 1 === 2 ?? 3 ** 4;', '[[],[["object",[["default",["??",["===",1,2],["**",3,4]]]]]]]')
            expect('export default -1 || ~2;', '[[],[["object",[["default",["||",["-",1],["~",2]]]]]]]')
            // a group is an operand, and mixes what the bare chain may not
            expect('export default (1 ?? 2) || 3;', '[[],[["object",[["default",["||",["??",1,2],3]]]]]]')
            expect('export default 1 ?? (2 || 3);', '[[],[["object",[["default",["??",1,["||",2,3]]]]]]]')
            expect('export default (1 && 2).x;', '[[],[["object",[["default",[".",["&&",1,2],"x"]]]]]]')
            // a function's body is its own operand, the whole chain
            expect('export default (...a) => a && 1 || 2;', '[[],[["object",[["default",["=>",0,[["||",["&&",["rest"],1],2]]]]]]]]')
            expect('export default 1 && ((...a) => 2);', '[[],[["object",[["default",["&&",1,["=>",0,[2]]]]]]]]')
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
            // `?.` is optional chaining, a token the language has no rule
            // for: refused at the token, which the tokenizer marks
            expect('export default 1?.x;', 17)
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
            expect('export default 1 ? 2 : 3;', '[[],[["object",[["default",["?:",1,2,3]]]]]]')
            expect('export default 1?2:3;', '[[],[["object",[["default",["?:",1,2,3]]]]]]')
            expect('export default 1 ? 2 : 3 ? 4 : 5;', '[[],[["object",[["default",["?:",1,2,["?:",3,4,5]]]]]]]')
            expect('export default 1 ? 2 ? 3 : 4 : 5;', '[[],[["object",[["default",["?:",1,["?:",2,3,4],5]]]]]]')
            // the condition is the whole short-circuit chain, and each arm
            // takes one of its own
            expect('export default 1 && 2 ? 3 || 4 : 5 ?? 6;', '[[],[["object",[["default",["?:",["&&",1,2],["||",3,4],["??",5,6]]]]]]]')
            expect('export default 1 + 2 ? 3 : 4;', '[[],[["object",[["default",["?:",["+",1,2],3,4]]]]]]')
            // an arm may be a function, its body ending where `:` cannot
            // continue it — `1 ? () => 2 : 3` is the function and the else
            // arm, as JavaScript reads it — or an object, an array, a group
            expect('export default 1 ? () => 2 : 3;', '[[],[["object",[["default",["?:",1,["=>",0,[2]],3]]]]]]')
            expect('export default 1 ? 2 : () => 3 ? 4 : 5;', '[[],[["object",[["default",["?:",1,2,["=>",0,[["?:",3,4,5]]]]]]]]]')
            expect('export default 1 ? { x: 2 } : [3];', '[[],[["object",[["default",["?:",1,["object",[["x",2]]],["array",[3]]]]]]]]')
            expect('export default (1 ? 2 : 3).x;', '[[],[["object",[["default",[".",["?:",1,2,3],"x"]]]]]]')
            expect('export default [1 ? 2 : 3, { a: 4 ? 5 : 6 }];', '[[],[["object",[["default",["array",[["?:",1,2,3],["object",[["a",["?:",4,5,6]]]]]]]]]]]')
            expect('export default (...a) => a ? 1 : 2;', '[[],[["object",[["default",["=>",0,[["?:",["rest"],1,2]]]]]]]]')
            expect('export default -1 ? -2 : ~3;', '[[],[["object",[["default",["?:",["-",1],["-",2],["~",3]]]]]]]')
            // three operands, resolved in order: the condition first, then
            // each arm, whether or not the program establishes it
            expect('const a = 1; export default a ? a : a;', '[[],[1,["object",[["default",["?:",["cref",0],["cref",0],["cref",0]]]]]]]')
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
}
