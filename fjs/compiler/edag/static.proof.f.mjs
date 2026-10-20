/**
 * The proof of the lowering of the built-ins a module reaches as values:
 * the helpers `entry` and `hasEntry` and the intrinsics, each the EDAG's
 * own node by its name, and the static functions, `['Object.is']`, read
 * in every spelling and run under a runtime whose `static` answers them.
 * It reads the compiler as `./proof.f.mjs` does, through the helpers it
 * exports; split from it as the parser's proofs are, since that file
 * reached the size the website's build reads a file up to.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 */

import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { apply, compile, execute, expectEdag, value } from './proof.f.mjs'

export const proof = {
    // The `entry` helper is the EDAG's own node for it, `['entry']`, the
    // helper as a value: one node per helper written, as every arrow is a
    // node of its own, and one however many references reach a `const`
    // holding it; called as any function is, and read as one — and the
    // graph runs, the executors answering the call themselves.
    entry: () => {
        const helper = 'const entry = (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; };'
        expectEdag(compile(`${helper} export default entry;`).edag, ['entry'])
        const shared = compile(`${helper} export default [entry, entry];`).edag
        expectEdag(shared, ['[]', [['entry'], ['entry']]])
        assert(shared instanceof Array && shared[0] === '[]' && shared[1][0] === shared[1][1], shared)
        const two = compile('export default [(a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable ? x.value : undefined; }, (c, d) => { const e = Object.getOwnPropertyDescriptor(c, d); return e?.enumerable ? e.value : undefined; }];').edag
        expectEdag(two, ['[]', [['entry'], ['entry']]])
        assert(two instanceof Array && two[0] === '[]' && two[1][0] !== two[1][1], two)
        expectEdag(compile(`${helper} export default entry({ k: 1 }, "k");`).edag, ['()', ['entry'], [['{}', [[':', 'k', 1]]], 'k']])
        // `hasEntry` is its own node the same way
        const has = 'const hasEntry = (a, b) => { const x = Object.getOwnPropertyDescriptor(a, b); return x?.enumerable === true; };'
        expectEdag(compile(`${has} export default hasEntry;`).edag, ['hasEntry'])
        expectEdag(compile(`${has} export default hasEntry({ k: 1 }, "k");`).edag, ['()', ['hasEntry'], [['{}', [[':', 'k', 1]]], 'k']])
        // an intrinsic's helper is its own node the same way, by the member's name
        const slice = 'const slice = (s, a, b) => s.slice(a, b);'
        expectEdag(compile(`${slice} export default slice;`).edag, ['slice'])
        expectEdag(compile(`${slice} export default slice("abc", 1, 2);`).edag, ['()', ['slice'], ['abc', 1, 2]])
        const charCodeAt = 'const charCodeAt = (s, i) => s.charCodeAt(i);'
        expectEdag(compile(`${charCodeAt} export default charCodeAt("abc", 1);`).edag, ['()', ['charCodeAt'], ['abc', 1]])
        expectEdag(compile(`${helper} export default [entry.length, typeof entry];`).edag, ['[]', [['.', ['entry'], 'length'], ['typeof', ['entry']]]])
        // an unreached helper is anchored as any entry is
        expectEdag(compile(`${helper} export default 1;`).edag, [',', [['entry'], 1]])
        assertStructurallySame(execute(compile(`${helper} export default [entry({ k: 1 }, "k"), entry([7, 8], 1), entry([7, 8], "length"), entry("ab", 0), entry(entry, "length"), entry.length, typeof entry, entry({ "1": 9 }, 1), entry({ u: undefined }, "u")];`).edag),
            [1, 8, undefined, 'a', undefined, 2, 'function', 9, undefined])
        // the helper passed as a value, and called from where it was passed
        assertStructurallySame(execute(compile(`${helper} const call = (f, o) => f(o, "x"); export default call(entry, { x: 3 });`).edag), 3)
        assertStructurallySame(execute(compile(`${helper} export default [10, 20].map(entry);`).edag), [undefined, undefined])
        const fn = value(compile(`${helper} export default entry;`).edag)
        assertStructurallySame(assertOk(toData(apply(fn, [['{}', [[':', 'y', 4]]], 'y']))), 4)
        assertStructurallySame(assertOk(toData(apply(fn, [['[]', [5]], 0]))), 5)
        // and the helper's text is the helper, in the writer's spelling
        assertStructurallySame(execute(compile(`${helper} export default entry.toString();`).edag), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}')
    },
    // `Object.is` is the EDAG's own node for it, `['Object.is']`, in every
    // spelling and through destructuring, which reads the namespace's
    // member as the access does; the graph runs under a runtime whose
    // `static` section binds it — the one function on every read — and
    // fails naming it under none.
    objectIs: () => {
        expectEdag(compile('export default Object.is;').edag, ['Object.is'])
        expectEdag(compile('export default Object?.["is"](0, -0);').edag, ['()', ['Object.is'], [0, -0]])
        expectEdag(compile('const { is } = Object; export default [is, Object.is];').edag, ['[]', [['Object.is'], ['Object.is']]])
        /** @type {import('../../edag/value/types.ts').Runtime} */
        const runtime = ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Object.is', ['=>', 2, [], ['===', ['arg', 0], ['arg', 1]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]]
        const run = memo(assertOk(analysis(compile('const { is } = Object; const f = () => Object.is; export default [is(1, 1), Object.is(1, 2), is === f(), [1].map(x => f()(x, 1))];').edag)))
        assertStructurallySame(assertOk(toData(unwrap(run({ args: [], runtime })))), [true, false, true, [true]])
        assertEq(assertError(run({ args: [] })), 'no binding for the static Object.is')
        // a `Number` predicate the same way, read at its own path
        expectEdag(compile('const { isInteger } = Number; export default [isInteger, Number?.["isFinite"]];').edag, ['[]', [['Number.isInteger'], ['Number.isFinite']]])
        /** @type {import('../../edag/value/types.ts').Runtime} */
        const numbers = ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Number.isNaN', ['=>', 1, [], ['typeof', ['arg', 0]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]]
        const typed = memo(assertOk(analysis(compile('const { isNaN } = Number; export default [isNaN("x"), Number.isNaN(1)];').edag)))
        assertStructurallySame(assertOk(toData(unwrap(typed({ args: [], runtime: numbers })))), ['string', 'number'])
        assertEq(assertError(typed({ args: [], runtime })), 'no binding for the static Number.isNaN')
    },
}
