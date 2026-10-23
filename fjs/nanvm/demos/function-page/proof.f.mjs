/**
 * Proofs for the function sample's WASM demo page, against an in-memory
 * page: files by path, a module whose exports are functions here, and a
 * `sandbox` that calls its thunk, reports a time of `1`, and reports a
 * thunk that answers {@link throws} as one that threw it.
 *
 * @import { Effect } from '../../../effects/types.ts'
 * @import { Sandbox } from '../../../effects/common/types.ts'
 * @import { FetchText, Instantiate, WasmInstance } from '../../../effects/browser/types.ts'
 * @import { MemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 * @import { Call, Calls, FunctionSample, State } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError, notImplemented } from '../../../effects/module.f.mjs'
import { run } from '../../../effects/mock/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { codePoints } from '../../../text/ascii/module.f.js'
import { rustPath, samplePath, wasmPath, watPath } from '../page/module.f.mjs'
import { agreement, callJs, edagView, functionDemo, init, load, microseconds, notLoaded, outcomeText, repeat, repetitions, runCalls, update, view, wasmCaller, wasmOutcome } from './module.f.mjs'
import { spell } from '../spell/module.f.mjs'

/** What a thunk answers to stand for a throw, which a proof cannot write. */
const throws = 'negative'

/** A sample that answers `input + 2`, and throws for a negative one. @type {FunctionSample} */
const plus2 = { place: { name: 'plus2', directory: 'spec/plus2', calls: [[1, ['returned', '3']], [-1, ['threw', '"negative"']]] }, entry: input => input < 0 ? throws : input + 2 }

/**
 * A module whose `plus2` export loads, answering `loads`, and whose every
 * `call_sample` keeps `answer`, as one that returned it or, for `threw`, as
 * one that threw it: the mock cannot keep the last call's text, so it keeps
 * one text for all of them.
 *
 * @type {(answer?: string, threw?: boolean, loads?: unknown) => WasmInstance}
 */
const instance = (answer = '3', threw = false, loads = 0) => ({
    exports: {
        plus2: () => loads,
        call_sample: () => threw ? -1 - answer.length : answer.length,
        output_byte: (/** @type {number} */ i) => codePoints(answer)[i],
    },
    startup: 2,
})

/**
 * The page's operations. A path in `files` is a text, `wasm` is the module,
 * and anything else is not found.
 *
 * @type {(files: StringMap<string>, wasm: WasmInstance | null, sandbox?: 'ok' | 'notImplemented' | 'thrown') => MemOperationMap<FetchText | Instantiate | Sandbox, null>}
 */
const page = (files, wasm, sandbox = 'ok') => ({
    fetchText: path => s => {
        const text = files[path]
        return [s, text === undefined ? error(ioError({ message: `${path}: HTTP 404` })) : ok(text)]
    },
    instantiate: path => s => [s, wasm === null ? error(ioError({ message: `${path}: HTTP 404` })) : ok(wasm)],
    sandbox: f => s => {
        if (sandbox === 'notImplemented') { return [s, error(notImplemented('sandbox'))] }
        if (sandbox === 'thrown') { return [s, ok({ result: error('boom'), duration: 1 })] }
        const value = f()
        return [s, /** @type {any} */ (ok({ result: value === throws || value === spell(throws) ? error(throws) : ok(value), duration: 1 }))]
    },
})

/** @type {<T>(map: MemOperationMap<FetchText | Instantiate | Sandbox, null>) => (effect: Effect<FetchText | Instantiate | Sandbox, T, never>) => T} */
const perform = map => effect => {
    const [, result] = run(map)(null)(effect)
    assert(result[0] === 'ok')
    return result[1]
}

const source = 'export default (...a) => (a[0], a[0] + 2);'

const files = { [`/${samplePath(plus2.place.directory)}`]: source, [`/${rustPath('plus2')}`]: 'pub fn module() {}', [`/${watPath('plus2')}`]: '(module)' }

/** Every loaded state. @type {State} */
const ready = perform(page(files, instance()))(load(plus2.place))

/** @type {(e: Element) => string} */
const text = e => JSON.stringify(e)

/**
 * A call the mock made: a run that returned made {@link repetitions} calls
 * in its time of 1 ms, and one that threw made one.
 *
 * @type {(outcome: Call['outcome']) => Result<Call, string>}
 */
const made = outcome => ok({ outcome, time: outcome[0] === 'threw' ? 1000 : 1000 / repetitions })

export const proof = {
    load: () => {
        assertStructurallySame(ready.source, ok(source))
        assertStructurallySame(ready.rust, ok('pub fn module() {}'))
        assertStructurallySame(ready.wat, ok('(module)'))
        assertEq(ready.wasm[0], 'ok')
        assertEq(ready.calls, null)
        // The graph is drawn once, as the source arrives.
        assertEq(JSON.stringify(ready.edag), JSON.stringify(edagView(source)))
        const missing = perform(page({}, null))(load(plus2.place))
        assertStructurallySame(missing.wasm, error(`/${wasmPath}: HTTP 404`))
    },
    callJs: () => {
        assertStructurallySame(perform(page({}, null))(callJs(plus2.entry)(1)), made(['returned', '3']))
        // A throw is an answer, with what was thrown.
        assertStructurallySame(perform(page({}, null))(callJs(plus2.entry)(-1)), made(['threw', '"negative"']))
        assertStructurallySame(perform(page({}, null, 'notImplemented'))(callJs(plus2.entry)(1)), error('operation not implemented: sandbox'))
    },
    wasmOutcome: () => {
        const read = wasmOutcome(i => codePoints('negative')[i])
        assertStructurallySame(read(8), ok(['returned', 'negative']))
        assertStructurallySame(read(-1 - 8), ok(['threw', 'negative']))
        assertStructurallySame(read(0), ok(['returned', '']))
        assertStructurallySame(read(notLoaded), error('no sample is loaded'))
        assertStructurallySame(wasmOutcome(() => 0xff)(1), error('the output is not UTF-8'))
    },
    wasmCaller: () => {
        const caller = perform(page({}, null))(wasmCaller('plus2')(instance()))
        assert(caller[0] === 'ok')
        assertStructurallySame(perform(page({}, null))(caller[1](1)), made(['returned', '3']))
        const threw = perform(page({}, null))(wasmCaller('plus2')(instance('negative', true)))
        assert(threw[0] === 'ok')
        assertStructurallySame(perform(page({}, null))(threw[1](-1)), made(['threw', 'negative']))
        // A kept text that is not UTF-8 is no answer.
        const garbled = perform(page({}, null))(wasmCaller('plus2')(instance('\xff')))
        assert(garbled[0] === 'ok')
        assertStructurallySame(perform(page({}, null))(garbled[1](1)), error('the output is not UTF-8'))
        assertEq(notLoaded, -0x8000_0000)
        // Loading that answers a throw, that throws, or cannot happen.
        assertStructurallySame(perform(page({}, null))(wasmCaller('plus2')(instance('3', false, -1))), error('the sample threw while loading'))
        assertStructurallySame(perform(page({}, null))(wasmCaller('plus2')(instance('3', false, throws))), error('the module threw while loading: negative'))
        assertStructurallySame(perform(page({}, null, 'notImplemented'))(wasmCaller('plus2')(instance())), error('operation not implemented: sandbox'))
        assertStructurallySame(
            perform(page({}, null))(wasmCaller('other')(instance())),
            error('the module does not export other, call_sample and output_byte'))
    },
    runCalls: () => {
        const called = perform(page({}, null))(runCalls(plus2)(ready))
        assert(called.calls !== null)
        assertEq(called.calls.map(/** @type {(c: Calls) => number} */ (c => c.input)).join(','), '1,-1')
        assertStructurallySame(called.calls[0].js, made(['returned', '3']))
        assertStructurallySame(called.calls[0].wasm, made(['returned', '3']))
        assertStructurallySame(called.calls[1].js, made(['threw', '"negative"']))
        // With no module, the JavaScript calls still happen.
        const loading = perform(page({}, null))(runCalls(plus2)(init))
        assertStructurallySame(loading.calls?.[0].js, made(['returned', '3']))
        assertStructurallySame(loading.calls?.[0].wasm, error('the module has not loaded yet'))
        const failed = perform(page({}, null))(runCalls(plus2)({ ...init, wasm: error('gone') }))
        assertStructurallySame(failed.calls?.[1].wasm, error('gone'))
    },
    repeat: () => {
        assertEq(repeat(3, () => 1), 1)
        // Stops at the first answer `stop` holds for.
        assertEq(repeat(3, () => -1, n => n < 0), -1)
        assertEq(microseconds(1.234), '1.23 µs')
    },
    outcomeText: () => {
        assertEq(outcomeText(['returned', '3']), 'Returned 3')
        assertEq(outcomeText(['threw', 'negative']), 'Threw negative')
    },
    agreement: () => {
        /** @type {(js: Result<Call, string>, wasm: Result<Call, string>) => Calls} */
        const calls = (js, wasm) => ({ input: 1, js, wasm })
        assertEq(agreement(calls(made(['returned', '3']), made(['returned', '3']))), 'Yes')
        assertEq(agreement(calls(made(['threw', '3']), made(['returned', '3']))), 'No')
        assertEq(agreement(calls(made(['returned', '3']), made(['returned', '4']))), 'No')
        assertEq(agreement(calls(made(['returned', '3']), error('no wasm'))), 'Not available')
        assertEq(agreement(calls(error('no js'), made(['returned', '3']))), 'Not available')
    },
    view: () => {
        const first = text(view([1, -1])(init))
        assert(first.includes('Loading…'))
        assert(first.includes('with 1, then -1'))
        // The verdict first, as on a refused or undecided page.
        assert(first.includes('In FunctionalScript'))
        assert(!first.includes('startup'))
        // Loaded: the graph, drawn and as text, and the Rust and the WAT.
        const shown = text(view([1, -1])(perform(page({}, null))(runCalls(plus2)(ready))))
        assert(shown.includes('Expression graph (EDAG)'))
        assert(shown.includes('<svg') || shown.includes('"svg"'))
        assert(shown.includes('.edag.data.js'))
        assert(shown.includes('pub fn module() {}'))
        assert(shown.includes('(module)'))
        assert(shown.includes('WebAssembly startup (fetch, compile and instantiate): 2.0 ms'))
        assert(shown.includes('default(-1)'))
        // What JavaScript threw, spelled: a string, quoted.
        assert(shown.includes(JSON.stringify('Threw "negative"').slice(1, -1)))
        assert(shown.includes(`Time per call: ${microseconds(1000 / repetitions)}`))
        assert(shown.includes('The same answer both ways: Yes'))
        // A source that does not parse is the parser's refusal, twice.
        const broken = text(view([1])({ ...init, source: ok('export default ('), edag: edagView('export default (') }))
        assert(broken.includes('Refused'))
        // Calls that could not happen.
        const refused = text(view([1])({ ...init, calls: [{ input: 1, js: error('no js'), wasm: error('no wasm') }] }))
        assert(refused.includes('no js'))
        assert(refused.includes('no wasm'))
    },
    update: () => {
        const map = page(files, instance())
        const loaded = perform(map)(update(plus2)(init)({ kind: 'start' }))
        assertEq(loaded.source[0], 'ok')
        assert(perform(map)(update(plus2)(loaded)({ kind: 'click', name: 'run' })).calls !== null)
        assertEq(perform(map)(update(plus2)(loaded)({ kind: 'click', name: 'other' })), loaded)
        assertEq(perform(map)(update(plus2)(loaded)({ kind: 'input', name: 'x', value: '' })), loaded)
    },
    functionDemo: () => {
        const demo = functionDemo(plus2)
        assertEq(demo.init, init)
        assert(text(demo.view(init)).includes('Run'))
    },
}
