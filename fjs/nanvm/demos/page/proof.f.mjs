/**
 * Proofs for the WASM demo page, against an in-memory page: files by path,
 * a module whose exports are functions here, and a `sandbox` that calls its
 * thunk and reports no time.
 *
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Sandbox } from '../../../effects/common/types.ts'
 * @import { FetchText, Instantiate, JsHeapSize, WasmInstance } from '../../../effects/browser/types.ts'
 * @import { MemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 * @import { Runs, Sample, State } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError, notImplemented } from '../../../effects/module.f.mjs'
import { run } from '../../../effects/mock/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { buildDirectory, decode, init, jsOutput, load, milliseconds, ratio, runBoth, runJs, runWasm, rustPath, samplePath, update, view, wasmDemo, wasmPath, watPath } from './module.f.mjs'

/** @type {(text: string) => Sample['program']} */
const writes = text => () => ({
    command: 'write',
    payload: ['stdout', utf8(text)],
    continuation: () => () => ['ok', undefined],
})

/** A sample writing `hi` to standard output and `no` to standard error. @type {Sample} */
const hi = {
    place: { name: 'hi', directory: 'fjs/nanvm/demos/hi' },
    program: () => ({
        command: 'write',
        payload: ['stderr', utf8('no')],
        continuation: () => writes('hi')(),
    }),
}

/**
 * A module whose `hi` export loads, or throws for `loads` false, and whose
 * run writes `bytes`, or throws for none.
 *
 * @type {(bytes: readonly number[] | null, loads?: boolean) => WasmInstance}
 */
const instance = (bytes, loads = true) => ({
    exports: {
        hi: () => loads ? 0 : -1,
        run_sample: () => bytes === null ? -1 : bytes.length,
        output_byte: (/** @type {number} */ i) => bytes === null ? 0 : bytes[i],
        memory: { buffer: { byteLength: 0x1_0000 } },
    },
    startup: 2,
})

/** What a mock export answers to stand for a throw. */
const throws = {}

/** A thunk's answer as `sandbox` reports it. @type {(value: unknown) => Result<unknown, unknown>} */
const thrown = value => value === throws ? error('boom') : ok(value)

/** Every operation the page performs. @typedef {FetchText | Instantiate | Sandbox | JsHeapSize} PageOp */

/**
 * The page's operations. A path in `files` is a text, `wasm` is the module,
 * and anything else is not found. `sandbox` is `null` for a page that does not
 * implement it, and `thrown` for a thunk that throws. `heap` is what the heap
 * reads, every time: `null` for a browser that does not report it.
 *
 * @type {(files: StringMap<string>, wasm: WasmInstance | null, sandbox?: 'ok' | 'notImplemented' | 'thrown', heap?: number | null | 'notImplemented') => MemOperationMap<PageOp, null>}
 */
const page = (files, wasm, sandbox = 'ok', heap = 1024) => ({
    fetchText: path => s => {
        const text = files[path]
        return [s, text === undefined ? error(ioError({ message: `${path}: HTTP 404` })) : ok(text)]
    },
    instantiate: path => s => [s, wasm === null ? error(ioError({ message: `${path}: HTTP 404` })) : ok(wasm)],
    sandbox: f => s => [s,
        sandbox === 'notImplemented' ? error(notImplemented('sandbox'))
        : sandbox === 'thrown' ? ok({ result: error('boom'), duration: 0 })
        : /** @type {any} */ (ok({ result: thrown(f()), duration: 1 }))],
    jsHeapSize: () => s => [s, heap === 'notImplemented' ? error(notImplemented('jsHeapSize')) : ok(heap)],
})

/** @type {<T>(map: MemOperationMap<PageOp, null>) => (effect: Effect<PageOp, T, never>) => T} */
const perform = map => effect => {
    const [, result] = run(map)(null)(effect)
    assert(result[0] === 'ok')
    return result[1]
}

const files = { '/fjs/nanvm/demos/hi/sample.f.js': 'export default 1', [`/${rustPath('hi')}`]: 'pub fn module() {}', [`/${watPath('hi')}`]: '(module)' }

/** Every loaded state. @type {State} */
const ready = perform(page(files, instance([0x68, 0x69])))(load(hi.place))

/** @type {(e: Element) => string} */
const text = e => JSON.stringify(e)

export const proof = {
    paths: () => {
        assertEq(samplePath('spec/operators/comma'), 'spec/operators/comma/sample.f.js')
        assertEq(rustPath('hello'), 'nanvm/demos/gen.samples/hello.rs')
        assertEq(wasmPath, `${buildDirectory}/nanvm_demos.wasm`)
        assertEq(watPath('hello'), `${buildDirectory}/hello.wat`)
    },
    load: () => {
        assertStructurallySame(ready.source, ok('export default 1'))
        assertStructurallySame(ready.rust, ok('pub fn module() {}'))
        assertStructurallySame(ready.wat, ok('(module)'))
        assertEq(ready.wasm[0], 'ok')
        assertEq(ready.runs, null)
        // A file that does not arrive is the reason it is not shown.
        const missing = perform(page({}, null))(load(hi.place))
        assertStructurallySame(missing.source, error(`/fjs/nanvm/demos/hi/sample.f.js: HTTP 404`))
        assertStructurallySame(missing.wasm, error(`/${wasmPath}: HTTP 404`))
    },
    decode: () => {
        assertStructurallySame(decode([0x68, 0x69]), ok('hi'))
        assertStructurallySame(decode([0xff]), error('the output is not UTF-8'))
    },
    jsOutput: () => {
        // Standard output only.
        assertStructurallySame(jsOutput(hi.program), ok('hi'))
        assertStructurallySame(jsOutput(() => () => error('x')), error('the program failed: x'))
    },
    runJs: () => {
        const r = perform(page({}, null))(runJs(hi.program))
        assert(r[0] === 'ok')
        assertStructurallySame(r[1], { output: ok('hi'), time: 1, heap: { before: 1024, after: 1024 } })
        // A browser without the heap, as every one but Chromium is, and a page
        // that does not implement reading it.
        const noHeap = perform(page({}, null, 'ok', null))(runJs(hi.program))
        assert(noHeap[0] === 'ok')
        assertEq(noHeap[1].heap, null)
        const notImplementedHeap = perform(page({}, null, 'ok', 'notImplemented'))(runJs(hi.program))
        assert(notImplementedHeap[0] === 'ok')
        assertEq(notImplementedHeap[1].heap, null)
        assertStructurallySame(perform(page({}, null, 'thrown'))(runJs(hi.program)), error('it threw: boom'))
        assertStructurallySame(perform(page({}, null, 'notImplemented'))(runJs(hi.program)), error('operation not implemented: sandbox'))
    },
    runWasm: () => {
        assertStructurallySame(
            perform(page({}, null))(runWasm('hi')(instance([0x68, 0x69]))),
            ok({ run: { output: ok('hi'), time: 1 }, memory: 0x1_0000 }))
        const threw = perform(page({}, null))(runWasm('hi')(instance(null)))
        assert(threw[0] === 'ok')
        assertStructurallySame(threw[1].run.output, error('the sample threw'))
        assertStructurallySame(perform(page({}, null))(runWasm('hi')(instance([], false))), error('the sample threw while loading'))
        // A throw while loading, and one while running.
        assertStructurallySame(perform(page({}, null, 'thrown'))(runWasm('hi')(instance([]))), error('it threw: boom'))
        const running = instance([])
        assertStructurallySame(
            perform(page({}, null))(runWasm('hi')({ ...running, exports: { ...running.exports, run_sample: () => throws } })),
            error('it threw: boom'))
        assertStructurallySame(
            perform(page({}, null))(runWasm('other')(instance([]))),
            error('the module does not export other, run_sample, output_byte and memory'))
    },
    runBoth: () => {
        const both = perform(page({}, null))(runBoth(hi)(ready))
        assert(both.runs !== null)
        assertEq(both.runs.js[0], 'ok')
        assertEq(both.runs.wasm[0], 'ok')
        // With no module, the JavaScript run still happens.
        const loading = perform(page({}, null))(runBoth(hi)(init))
        assertStructurallySame(loading.runs?.wasm, error('the module has not loaded yet'))
        const failed = perform(page({}, null))(runBoth(hi)({ ...init, wasm: error('gone') }))
        assertStructurallySame(failed.runs?.wasm, error('gone'))
    },
    milliseconds: () => assertEq(milliseconds(1.54), '1.5 ms'),
    ratio: () => {
        /** @type {(js: number, wasm: number) => Runs} */
        const runs = (js, wasm) => ({ js: ok({ output: ok(''), time: js, heap: null }), wasm: ok({ run: { output: ok(''), time: wasm }, memory: 0 }) })
        assertEq(ratio(runs(4, 10)), '2.5×')
        // A JavaScript time the clock reads as `0`, and a run that failed.
        assertEq(ratio(runs(0, 10)), 'Not available')
        assertEq(ratio({ ...runs(4, 10), wasm: error('no wasm') }), 'Not available')
        // A run whose output failed: the program failed, or wrote no UTF-8.
        assertEq(ratio({ ...runs(4, 10), js: ok({ output: error('the program failed: x'), time: 4, heap: null }) }), 'Not available')
        assertEq(ratio({ ...runs(4, 10), wasm: ok({ run: { output: error('the sample threw'), time: 10 }, memory: 0 }) }), 'Not available')
        // Outputs that differ.
        assertEq(ratio({ ...runs(4, 10), wasm: ok({ run: { output: ok('other'), time: 10 }, memory: 0 }) }), 'Not available')
    },
    view: () => {
        // Before loading: no startup and no runs.
        const first = text(view('hi')(init))
        assert(first.includes('Loading…'))
        assert(!first.includes('startup'))
        assert(!first.includes('"JavaScript"'))
        // Loaded, run, and an empty output said in words.
        const both = perform(page({}, null))(runBoth(hi)(ready))
        const shown = text(view('hi')(both))
        assert(shown.includes('WebAssembly startup (fetch, compile and instantiate): 2.0 ms'))
        assert(shown.includes('Running time: 1.0 ms'))
        assert(shown.includes('Linear memory after the run: 65536 bytes'))
        assert(shown.includes('JavaScript heap in use, before and after the run (Chromium): 1024 → 1024 bytes'))
        // No heap line where the browser does not report it.
        const noHeap = text(view('hi')(perform(page({}, null, 'ok', null))(runBoth(hi)(ready))))
        assert(!noHeap.includes('JavaScript heap'))
        assert(!noHeap.includes('Not available'))
        assert(shown.includes('WebAssembly running time, as a multiple of the JavaScript one: 1.0×'))
        assert(shown.includes('pub fn module() {}'))
        const empty = text(view('hi')({ ...ready, runs: { js: ok({ output: ok(''), time: 0, heap: null }), wasm: ok({ run: { output: error('the sample threw'), time: 0 }, memory: 0 }) } }))
        assert(empty.includes('(empty)'))
        assert(empty.includes('the sample threw'))
        // Runs that could not happen, and files that did not arrive.
        const refused = text(view('hi')({ ...init, source: error('lost'), runs: { js: error('no js'), wasm: error('no wasm') } }))
        assert(refused.includes('lost'))
        assert(refused.includes('no js'))
        assert(refused.includes('no wasm'))
    },
    update: () => {
        const map = page(files, instance([0x68, 0x69]))
        const loaded = perform(map)(update(hi)(init)({ kind: 'start' }))
        assertEq(loaded.source[0], 'ok')
        assert(perform(map)(update(hi)(loaded)({ kind: 'click', name: 'run' })).runs !== null)
        assertEq(perform(map)(update(hi)(loaded)({ kind: 'click', name: 'other' })), loaded)
        assertEq(perform(map)(update(hi)(loaded)({ kind: 'input', name: 'x', value: '' })), loaded)
    },
    wasmDemo: () => {
        const demo = wasmDemo(hi)
        assertEq(demo.init, init)
        assert(text(demo.view(init)).includes('Run'))
    },
}
