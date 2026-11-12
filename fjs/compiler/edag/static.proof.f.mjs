/**
 * The proof of the lowering of the built-ins a module reaches as values:
 * the helpers `entry` and `hasEntry` and the intrinsics, each the EDAG's
 * own node by its name, and the static functions, `['Object.is']`, read
 * in either key spelling and run under a runtime whose `static` answers
 * them.
 * It reads the compiler as `./proof.f.mjs` does, through the helpers it
 * exports; split from it as the parser's proofs are, since that file
 * reached the size the website's build reads a file up to.
 *
 * No `@module`: a proof's documentation reaches no reader of the published
 * API, which is the case that rule names outright.
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Runtime } from '../../edag/value/types.ts'
 */

import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { read } from '../../edag/value/property/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import runtimeEdag from '../../js/runtime/gen.edag.js'
import { unwrap } from '../../types/result/module.f.js'
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { apply, compile, execute, expectEdag, value } from './proof.f.mjs'

/** The authored common runtime, evaluated without requiring a runtime. @type {() => Runtime} */
const commonRuntime = () => {
    const runtime = assertOk(read(['ok', value(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag)))], 'runtime'))
    assert(runtime instanceof Array && runtime[0] === '{}')
    return runtime
}

/** A graph whose member calls need the common runtime. @type {(graph: Exp) => unknown} */
const executeWithRuntime = graph => assertOk(toData(unwrap(memo(assertOk(analysis(graph)))({ args: [], runtime: commonRuntime() }))))

export const proof = {
    mathLog2: () => {
        expectEdag(compile('export default Math.log2(8);').edag, ['()', ['Math.log2'], [8]])
        expectEdag(compile('const { log2 } = Math; export default [log2, Math["log2"], log2.length];').edag,
            ['[]', [['Math.log2'], ['Math.log2'], ['.', ['Math.log2'], 'length']]])
        const run = memo(assertOk(analysis(compile('export default Math.log2;').edag)))
        assertEq(assertError(run({ args: [] })), 'no binding for the static Math.log2')
    },
    // A native static is callable without a common runtime and retains the
    // same function value when read through the namespace or destructuring.
    mathTrunc: () => {
        expectEdag(compile('export default Math.trunc(3.75);').edag, ['()', ['Math.trunc'], [3.75]])
        expectEdag(compile('const { trunc } = Math; export default [trunc, Math["trunc"], trunc.length];').edag,
            ['[]', [['Math.trunc'], ['Math.trunc'], ['.', ['Math.trunc'], 'length']]])
        assertStructurallySame(execute(compile('const { trunc } = Math; const read = () => Math.trunc; export default [trunc(3.75), Math["trunc"](-3.75), Math.trunc?.(-0.75), trunc === read(), read() === read(), trunc.length, typeof trunc];').edag),
            [3, -3, -0, true, true, 1, 'function'])
    },
    mathFloor: () => {
        expectEdag(compile('export default Math.floor(3.75);').edag, ['()', ['Math.floor'], [3.75]])
        expectEdag(compile('const { floor } = Math; export default [floor, Math["floor"], floor.length];').edag,
            ['[]', [['Math.floor'], ['Math.floor'], ['.', ['Math.floor'], 'length']]])
        assertStructurallySame(execute(compile('const { floor } = Math; const read = () => Math.floor; export default [floor(3.75), Math["floor"](-0.75), Math.floor?.(0.75), floor(-0), floor === read(), read() === read(), floor === Math.trunc, floor.length, typeof floor];').edag),
            [3, -1, 0, -0, true, true, false, 1, 'function'])
    },
    mathAbs: () => {
        expectEdag(compile('export default Math.abs(3.75);').edag, ['()', ['Math.abs'], [3.75]])
        expectEdag(compile('const { abs } = Math; export default [abs, Math["abs"], abs.length];').edag,
            ['[]', [['Math.abs'], ['Math.abs'], ['.', ['Math.abs'], 'length']]])
        assertStructurallySame(execute(compile('const { abs } = Math; const read = () => Math.abs; export default [abs(-3.75), Math["abs"](-Infinity), Math.abs?.(-0.75), abs === read(), read() === read(), abs === Math.floor, abs === Math.trunc, abs.length, typeof abs, String(abs)];').edag),
            [3.75, Infinity, 0.75, true, true, false, false, 1, 'function', 'function abs() { [native code] }'])
        assert(Object.is(execute(compile('export default Math.abs(-0);').edag), 0))
    },
    mathSqrt: () => {
        expectEdag(compile('export default Math.sqrt(4);').edag, ['()', ['Math.sqrt'], [4]])
        expectEdag(compile('const { sqrt } = Math; export default [sqrt, Math["sqrt"], sqrt.length];').edag,
            ['[]', [['Math.sqrt'], ['Math.sqrt'], ['.', ['Math.sqrt'], 'length']]])
        assertStructurallySame(execute(compile('const { sqrt } = Math; const read = () => Math.sqrt; export default [sqrt(4), Math["sqrt"](-1), Math.sqrt?.(-0), sqrt(Infinity), sqrt === read(), read() === read(), sqrt === Math.ceil, sqrt === Math.imul, sqrt.length, typeof sqrt, String(sqrt)];').edag),
            [2, NaN, -0, Infinity, true, true, false, false, 1, 'function', 'function sqrt() { [native code] }'])
    },
    mathCeil: () => {
        expectEdag(compile('export default Math.ceil(0.75);').edag, ['()', ['Math.ceil'], [0.75]])
        expectEdag(compile('const { ceil } = Math; export default [ceil, Math["ceil"], ceil.length];').edag,
            ['[]', [['Math.ceil'], ['Math.ceil'], ['.', ['Math.ceil'], 'length']]])
        assertStructurallySame(execute(compile('const { ceil } = Math; const read = () => Math.ceil; export default [ceil(0.75), Math["ceil"](-0.75), Math.ceil?.(-1.75), ceil(-0), ceil === read(), read() === read(), ceil === Math.floor, ceil === Math.sqrt, ceil.length, typeof ceil, String(ceil)];').edag),
            [1, -0, -1, -0, true, true, false, false, 1, 'function', 'function ceil() { [native code] }'])
    },
    mathImul: () => {
        expectEdag(compile('export default Math.imul(7, 3);').edag, ['()', ['Math.imul'], [7, 3]])
        expectEdag(compile('const { imul } = Math; export default [imul, Math["imul"], imul.length];').edag,
            ['[]', [['Math.imul'], ['Math.imul'], ['.', ['Math.imul'], 'length']]])
        assertStructurallySame(execute(compile('const { imul } = Math; const read = () => Math.imul; export default [imul(0xffff_ffff, 5), Math["imul"](0x8000_0000, 2), Math.imul?.(0x7fff_ffff, 2), imul(), imul(2), imul === read(), read() === read(), imul === Math.sqrt, imul === Math.ceil, imul.length, typeof imul, String(imul)];').edag),
            [-5, 0, -2, 0, 0, true, true, false, false, 2, 'function', 'function imul() { [native code] }'])
    },
    mathMax: () => {
        expectEdag(compile('export default Math.max(1, 2, 3);').edag, ['()', ['Math.max'], [1, 2, 3]])
        expectEdag(compile('const { max } = Math; export default [max, Math["max"], max.length];').edag,
            ['[]', [['Math.max'], ['Math.max'], ['.', ['Math.max'], 'length']]])
        assertStructurallySame(execute(compile('const { max } = Math; const read = () => Math.max; export default [max(), max(-0), max(-0, 0), max(0, -0), max(-0, -0), max(1, 9, 3), Math["max"](-4, -3), Math.max?.(-Infinity, -2), max(NaN, 4), max === read(), read() === read(), max === Math.imul, max.length, typeof max, String(max)];').edag),
            [-Infinity, -0, 0, 0, -0, 9, -3, -2, NaN, true, true, false, 2, 'function', 'function max() { [native code] }'])
    },
    mathMin: () => {
        expectEdag(compile('export default Math.min(1, 2, 3);').edag, ['()', ['Math.min'], [1, 2, 3]])
        expectEdag(compile('const { min } = Math; export default [min, Math["min"], min.length];').edag,
            ['[]', [['Math.min'], ['Math.min'], ['.', ['Math.min'], 'length']]])
        assertStructurallySame(execute(compile('const { min } = Math; const read = () => Math.min; export default [min(), min(0), min(-0), min(0, -0), min(-0, 0), min(0, 0), min(4, -9, 3), Math["min"](4, 3), Math.min?.(Infinity, 2), min(NaN, 4), min === read(), read() === read(), min === Math.max, min.length, typeof min, String(min)];').edag),
            [Infinity, 0, -0, -0, -0, 0, -9, 3, 2, NaN, true, true, false, 2, 'function', 'function min() { [native code] }'])
    },
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
        assertStructurallySame(executeWithRuntime(compile(`${helper} export default [10, 20].map(entry);`).edag), [undefined, undefined])
        const fn = value(compile(`${helper} export default entry;`).edag)
        assertStructurallySame(assertOk(toData(apply(fn, [['{}', [[':', 'y', 4]]], 'y']))), 4)
        assertStructurallySame(assertOk(toData(apply(fn, [['[]', [5]], 0]))), 5)
        // and the helper's text is the helper, in the writer's spelling
        assertStructurallySame(execute(compile(`${helper} export default entry.toString();`).edag), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}')
    },
    // `Object.is` is the EDAG's own node for it, `['Object.is']`, in either
    // key spelling and through destructuring, which reads the namespace's
    // member as the access does; the graph runs under a runtime whose
    // `static` section binds it — the one function on every read — and
    // fails naming it under none.
    objectIs: () => {
        expectEdag(compile('export default Object.is;').edag, ['Object.is'])
        expectEdag(compile('export default Object["is"](0, -0);').edag, ['()', ['Object.is'], [0, -0]])
        expectEdag(compile('const { is } = Object; export default [is, Object.is];').edag, ['[]', [['Object.is'], ['Object.is']]])
        /** @type {import('../../edag/value/types.ts').Runtime} */
        const runtime = ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Object.is', ['=>', 2, [], ['===', ['arg', 0], ['arg', 1]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]]
        const run = memo(assertOk(analysis(compile('const { is } = Object; const f = () => Object.is; export default [is(1, 1), Object.is(1, 2), is === f(), [1].map(x => f()(x, 1))];').edag)))
        assertStructurallySame(assertOk(toData(unwrap(run({ args: [], runtime: ['{}', [
            ...runtime[1], [':', 'dot', assertOk(read(['ok', commonRuntime()], 'dot'))],
        ]] })))), [true, false, true, [true]])
        assertEq(assertError(run({ args: [] })), 'no binding for the static Object.is')
        // a `Number` predicate the same way, read at its own path
        expectEdag(compile('const { isInteger } = Number; export default [isInteger, Number["isFinite"]];').edag, ['[]', [['Number.isInteger'], ['Number.isFinite']]])
        /** @type {import('../../edag/value/types.ts').Runtime} */
        const numbers = ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Number.isNaN', ['=>', 1, [], ['typeof', ['arg', 0]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]]
        const typed = memo(assertOk(analysis(compile('const { isNaN } = Number; export default [isNaN("x"), Number.isNaN(1)];').edag)))
        assertStructurallySame(assertOk(toData(unwrap(typed({ args: [], runtime: numbers })))), ['string', 'number'])
        assertEq(assertError(typed({ args: [], runtime })), 'no binding for the static Number.isNaN')
    },
}
