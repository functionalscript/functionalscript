/**
 * The proof of call statements, `assert(a);`: a call evaluated for its
 * failure and its value discarded, read as a `const` nothing can read
 * ([spec: call statements](../../../spec/functions/call-statements.md)). A file of its own,
 * as `./operators.proof.f.mjs` is, since `./proof.f.mjs` stands at what the
 * website's build accepts in one file. It reads the parser as that proof
 * does, through the helpers it exports.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { parseFromTokens } from './module.f.mjs'
import { expectModule, expectRefused, tokenizeString } from './proof.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'

/** A module's AST, which the source must be accepted to have. @type {(source: string) => import('../ast/types.ts').AstModule} */
const astOf = source => {
    const [tag, value] = parseFromTokens(tokenizeString(source))
    assert(tag === 'ok', value)
    return value
}

/** A module's EDAG, as the lowering makes it. @type {(source: string) => unknown} */
const edagOf = source => unresolved(astOf(source)).edag

/** A module run on the represented interpreter: its result, or its failure. @type {(source: string) => import('../../types/result/types.ts').Result<unknown, unknown>} */
const run = source => memo(assertOk(analysis(unresolved(astOf(source)).edag)))({ args: [] })

const f = 'const f = (...a) => a[0] ? 1 : (() => { throw a[1]; })();'

export const proof = {
    // `f(x);` is `const _ = f(x);` where nothing can read `_`: the same
    // AST, and the same graph as the comma, `(f(x), rest)`.
    sugar: () => {
        assertStructurallySame(astOf(`${f} f(1); export default 2;`), astOf(`${f} const _ = f(1); export default 2;`))
        assertStructurallySame(edagOf(`${f} f(1); export default 2;`), edagOf(`${f} export default (f(1), 2);`))
        assertStructurallySame(
            edagOf(`${f} export default (...a) => { f(a[0]); return a; };`),
            edagOf(`${f} export default (...a) => (f(a[0]), a);`))
    },
    // It stands wherever a `const` does: before the exports and among the
    // exported `const`s, in a body, in a guard's block, in a loop's block
    // and in a case's — each anchored at that block's root, so the guard's
    // and the case's establish it only where JavaScript would.
    blocks: () => {
        expectModule('const f = (...a) => 1; f(1); export default 2;',
            '[[],[["=>",0,[1]],["()",["cref",0],[1]],["object",[[":","default",2]]]]]')
        expectModule('const f = (...a) => 1; export const a = 1; f(a)\nexport const b = 2;',
            '[[],[["=>",0,[1]],1,["()",["cref",0],[["cref",1]]],2,["object",[[":","a",["cref",1]],[":","b",["cref",3]]]]]]')
        assertStructurallySame(edagOf('export default (...a) => { a.f(1); return a; };'),
            ['{}', [[':', 'default', ['=>', 0, [], [',', [['.', ['rest'], 'f', ['|()', [1]]], ['rest']]]]]]])
        assertStructurallySame(edagOf('export default (...a) => { if (a[0]) { a.f(1); return 1; } return 2; };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['?:', ['.', ['rest'], 0], [',', [['.', ['rest'], 'f', ['|()', [1]]], 1]], 2]]]]])
        assertStructurallySame(edagOf('export default (...a) => { switch (a[0]) { case 1: { a.f(1); return 1; } default: { return 2; } } };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['?:', ['===', ['.', ['rest'], 0], 1], [',', [['.', ['rest'], 'f', ['|()', [1]]], 1]], 2]]]]])
        assertStructurallySame(edagOf('export default (...a) => { let r = 0; while (r < 1) { a.f(r); r = 1; } return r; };'),
            ['{}', [[':', 'default', ['=>', 0, [], ['()', ['=>', 1, [['rest']], ['?:', ['<', ['arg', 0], 1], [',', [['.', ['frame', 0], 'f', ['|()', [['arg', 0]]]], ['()', ['self'], [1]]]], ['arg', 0]]], [0]]]]]])
    },
    // Any call: of a name, of a member, guarded, a chain whose last step is
    // a call, a call of a call, and a static function's.
    shapes: () => {
        expectModule('const o = { f: (...a) => 1 }; o.f(1); o?.f(2); o.f?.(3); o?.f(4).g(5); o?.f?.(6)(7); export default 1;',
            '[[],[["object",[[":","f",["=>",0,[1]]]]],["()",[".",["cref",0],"f"],[1]],["?.",["cref",0],"f",["|()",[2]]],[".",["cref",0],"f",["|?.()",[3]]],["?.",["cref",0],"f",["|()",[4],["|.","g",["|()",[5]]]]],["?.",["cref",0],"f",["|?.()",[6],["|()",[7]]]],["object",[[":","default",1]]]]]')
        expectModule('const f = (...a) => f; f(1)(2); f?.(3); Object.is(1, 2); export default 1;',
            '[[],[["=>",0,[["self"]]],["()",["()",["cref",0],[1]],[2]],["?.()",["cref",0],[3]],["()",["Object.is"],[1,2]],["object",[[":","default",1]]]]]')
    },
    // A statement that is no call is refused at its name: an operator's
    // result discarded is almost always a mistake, and a conversion is an
    // operator, not a call. An assignment outside a loop's block is
    // refused at its `=`, and a statement on the line of the one before it
    // without its `;` at its name, as JavaScript refuses both.
    refused: () => {
        for (const statement of [
            'x;',
            'x.y;',
            'x?.y;',
            'x(1).y;',
            'x?.(1).y;',
            'x?.y(1).z;',
            'x(1) + 1;',
            'x(1) ? 1 : 2;',
            'x(1) && x(2);',
            'x => 1;',
            'Number(x);',
            'String(x);',
            'Number();',
        ]) { expectRefused(`const x = 1; ${statement} export default 1;`, 'unexpected token', 14) }
        expectRefused('const x = 1; export default (...a) => { x; return a; };', 'unexpected token', 41)
        expectRefused('const x = 1; export default (...a) => { let r = 0; while (r) { x.y; r = 1; } return r; };', 'unexpected token', 64)
        expectRefused('const x = 1; Number?.(x); export default 1;', 'reserved word', 14)
        expectRefused('const x = 1; x = 2; export default 1;', 'unexpected token', 16)
        expectRefused('const x = (...a) => 1; x(1) x(2); export default 1;', 'unexpected token', 29)
    },
    // The call is evaluated, its value discarded, and its failure the
    // module's or the function's, as JavaScript's is.
    evaluated: () => {
        assertStructurallySame(run(`${f} f(1); export default 2;`), ['ok', ['{}', [[':', 'default', 2]]]])
        assertEq(run(`${f} f(0, 'boom'); export default 2;`)[0], 'error')
        assertEq(run(`${f} const g = (...a) => { f(a[0], 'no'); return 3; }; export default g(0);`)[0], 'error')
        assertStructurallySame(run(`${f} const g = (...a) => { f(a[0], 'no'); return 3; }; export default g(1);`), ['ok', ['{}', [[':', 'default', 3]]]])
    },
}
