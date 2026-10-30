/**
 * A FunctionalScript module as its EDAG, and that graph run by both of this
 * directory's interpreters.
 *
 * **The graph is the compiler's own.** The listing is what
 * `fjs compile input.f.js output.edag.data.js` writes, taken from
 * [`compiler/demo`](../compiler/demo.f.mjs)'s `compiled`, so this page cannot
 * show a graph the command would not write. A node used more than once is
 * named once, as a `const`, and referenced by that name: in the initial
 * module `sq(3)` is one node read twice.
 *
 * **The two interpreters differ only in what they remember**, and the
 * initial module is chosen to show it. [`memo`](./memo/module.f.mjs)
 * evaluates each shared node once per call and reuses the value;
 * [`amnesia`](./amnesia/README.md) evaluates a node again at every edge that
 * reaches it. For a number that changes nothing, so both answer `9` for
 * `sq(3)`. For a constructor it changes identity: `o` is one `{}` node read
 * twice, so `o === o` is `true` under memo and `false` under amnesia, which
 * builds two objects. That is amnesia's documented, deliberate difference,
 * and the reason sharing is part of a program's meaning
 * ([`README.md`](./README.md)).
 *
 * **A failure is an answer.** An operation's own failure, such as `1n / 0n`,
 * is `error(['undefined'])` in both interpreters ([`README.md`](./README.md)),
 * shown as what the module throws.
 *
 * **Both run under the package runtime**, `fjs/js/runtime`, as the compiler's
 * own executors do, so a built-in the runtime defines, such as
 * `'abc'.startsWith('a')`, answers here as it does there.
 *
 * **It needs no operations.** Compiling and interpreting are pure functions of
 * the text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { EdagValue, Runtime } from './value/types.ts'
 * @import { Exp } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { codeMarker } from '../website/style/module.f.js'
import { caption, refusal, textDemo } from '../website/demo/module.f.mjs'
import { compiled } from '../compiler/demo.f.mjs'
import { parse } from '../compiler/transpiler/module.f.mjs'
import { unresolved } from '../compiler/edag/module.f.mjs'
import { toText } from '../text/marked/module.f.mjs'
import { identityAnalysis } from './analysis/module.f.mjs'
import { memo } from './memo/module.f.mjs'
import { vm } from './amnesia/module.f.mjs'
import { read } from './value/property/module.f.mjs'
import { assertOk } from '../asserts/module.f.js'
import runtimeEdag from '../js/runtime/gen.edag.data.js'
import { toData } from './value/to_unknown/module.f.mjs'
import { trySerialize } from '../media/datajs/serializer/module.f.mjs'
import { toArray } from '../types/list/alt/module.f.mjs'
import { error, ok } from '../types/result/module.f.js'

/**
 * The package runtime as an executor takes it: `fjs/js/runtime`'s EDAG,
 * which `npm run gen` writes beside its source, evaluated and read for its
 * `runtime` export.
 *
 * @type {Runtime}
 */
const runtime = /** @type {Runtime} */ (assertOk(read(
    vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))),
    'runtime')))

/**
 * An evaluated value as the page prints it: a DataJS document, which spells
 * `undefined` and a `bigint` as JSON cannot, or why it has no data form — a
 * function, say.
 *
 * @type {(v: EdagValue) => string}
 */
const data = v => {
    const d = toData(v)
    if (d[0] === 'error') { return `(${d[1]})` }
    // toData produces function-free data with plain containers, which the
    // DataJS serializer accepts by construction.
    return toArray(assertOk(trySerialize(d[1]))).join('')
}

/**
 * An interpreter's answer for a module: the module's exports, or what it
 * threw.
 *
 * @type {(r: Result<EdagValue, EdagValue>) => string}
 */
export const answer = r => r[0] === 'ok' ? data(r[1]) : `throws ${data(r[1])}`

/**
 * The module's graph run by `memo` and by `amnesia`, or why it could not be
 * built.
 *
 * @type {(text: string) => Result<readonly [memo: string, amnesia: string], string>}
 */
export const run = text => {
    const ast = parse('')(text)
    if (ast[0] === 'error') { return error(ast[1].message) }
    /** @type {Exp} */
    const graph = unresolved(ast[1]).edag
    // The compiler establishes the graph's lengths and scope invariants.
    const analyzed = assertOk(identityAnalysis(graph))
    return ok([answer(memo(analyzed)({ args: [], runtime })), answer(vm({ frame: [], args: [], runtime })(graph))])
}

/** @type {Demo<string, DemoEvent>} */
export const demo = textDemo({
    intro: 'Type a FunctionalScript module. Below are its EDAG, as fjs compile writes it, and what each interpreter answers for it. memo evaluates a shared node once; amnesia evaluates it again at every edge, so a shared object is two objects there.',
    name: 'module',
    label: 'Module',
    rows: 4,
    init: 'const sq = x => x * x\nconst a = sq(3)\nconst o = {}\nexport default [a, a + 1, [1, 2].map(sq), o === o]\n',
})(text => {
    const edag = compiled(text)('output.edag.data.js')
    if (edag[0] === 'error') { return [refusal(edag[1])] }
    // compiled already parsed this source successfully; run uses that parser.
    const [byMemo, byAmnesia] = assertOk(run(text))
    return [
        caption('The EDAG (output.edag.data.js):'),
        ['pre', { [codeMarker]: '' }, toText(edag[1])],
        caption('memo answers:'),
        ['pre', { [codeMarker]: '' }, byMemo],
        caption('amnesia answers:'),
        ['pre', { [codeMarker]: '' }, byAmnesia],
    ]
})
