/**
 * The WASM demo page ([`todo/wasm-demos.md`](../../../../todo/wasm-demos.md)),
 * one per sample: the sample's FunctionalScript source, the Rust
 * `fjs compile` writes for it, the disassembly of the WebAssembly that Rust
 * builds to, and a Run button that runs it as
 * JavaScript and then as WebAssembly, showing each run's output and stats.
 *
 * **The disassembly is a scrolling box, not a disclosure.** A `details` the
 * reader opened is closed again by the next render, which puts its markup
 * back, so pressing Run would hide the WAT the reader was reading.
 *
 * **The page loads before the reader asks.** The source, the Rust, the
 * disassembly and the module are fetched on `start`, so the times Run shows
 * hold the entry call alone: no fetch, compile or instantiation. The
 * module's startup is shown on its own line.
 *
 * **The JavaScript run performs the program in memory**, through the mock
 * runner, keeping what it writes to standard output; the WebAssembly run
 * loads the sample with its export in `nanvm-demos` and then calls
 * `run_sample`, which performs the same program on the NaNVM host and keeps
 * its output for the page to read back.
 *
 * @module
 *
 * @import { Sandbox, SandboxResult, Write } from '../../../effects/common/types.ts'
 * @import { FetchText, Instantiate, WasmInstance } from '../../../effects/browser/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Element, Node } from '../../../media/html/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { MemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Demo, DemoEvent } from '../../../website/demo/types.ts'
 * @import { Loaded, Run, Runs, Sample, State, WasmRun } from './types.ts'
 */

import { sandbox } from '../../../effects/common/module.f.mjs'
import { fetchText, instantiate } from '../../../effects/browser/module.f.mjs'
import { errorMessage, history, historyStep, pure, pureOk, resultMapStep, resultStep, step } from '../../../effects/module.f.mjs'
import { run as mockRun } from '../../../effects/mock/module.f.mjs'
import { empty, msb, u8ListMsb } from '../../../types/bit_vec/module.f.mjs'
import { fromU8List } from '../../../text/utf8/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { caption, refusal } from '../../../website/demo/module.f.mjs'
import { codeBlock } from '../../../website/demo/code/module.f.js'
import { highlight } from '../../../website/demo/highlight/module.f.mjs'
import { codeMarker, listingMarker } from '../../../website/style/module.f.js'

/** A sample's source, repository-relative. @type {(name: string) => string} */
export const samplePath = name => `fjs/nanvm/demos/${name}/sample.f.mjs`

/** Where the compiled samples go, a `gen.` name `gen:clean` empties. */
export const rustDirectory = 'nanvm/demos/gen.samples'

/** The Rust `fjs compile` writes for a sample, committed. @type {(name: string) => string} */
export const rustPath = name => `${rustDirectory}/${name}.rs`

/**
 * Where the deployment build puts the module and its disassembly: a `_` name,
 * which git ignores and the site serves.
 */
export const buildDirectory = 'nanvm/demos/_build'

/** The module every sample is in, as `cargo build` names it. */
export const wasmPath = `${buildDirectory}/nanvm_demos.wasm`

/**
 * A sample's disassembly: the functions Rust compiled from its module alone,
 * without NaNVM or `std`.
 *
 * @type {(name: string) => string}
 */
export const watPath = name => `${buildDirectory}/${name}.wat`

/** @type {State} */
export const init = { source: ['loading'], rust: ['loading'], wat: ['loading'], wasm: ['loading'], runs: null }

/** @type {<T>(r: Result<T, IoChannel>) => Result<T, string>} */
const loaded = r => r[0] === 'ok' ? r : error(errorMessage(r[1]))

/**
 * Fetches the source, the Rust, the disassembly and the module, each in
 * turn; a file that does not arrive is the reason it is not shown.
 *
 * @type {(name: string) => Effect<FetchText | Instantiate, State, never>}
 */
export const load = name => {
    const source = resultStep(fetchText(`/${samplePath(name)}`), r => pureOk(/** @type {State} */ ({ ...init, source: loaded(r) })))
    const rust = step(source, state => resultStep(fetchText(`/${rustPath(name)}`), r => pureOk({ ...state, rust: loaded(r) })))
    const wat = step(rust, state => resultStep(fetchText(`/${watPath(name)}`), r => pureOk({ ...state, wat: loaded(r) })))
    return step(wat, state => resultStep(instantiate(`/${wasmPath}`), r => pureOk({ ...state, wasm: loaded(r) })))
}

/** Bytes as text, refused unless they are UTF-8. @type {(bytes: List<number>) => Result<string, string>} */
export const decode = bytes => {
    const text = fromU8List(bytes)
    return text === null ? error('the output is not UTF-8') : ok(text)
}

/**
 * Performs a program in memory: what it wrote to standard output, as a bit
 * vector, and how it ended. Standard error is not kept: a page shows standard
 * output only.
 *
 * @type {(program: Sample['program']) => readonly [Vec, Result<unknown, unknown>]}
 */
export const jsPerform = program => {
    /** @type {MemOperationMap<Write, Vec>} */
    const map = { write: (stream, data) => state => [stream === 'stdout' ? msb.concat(state)(data) : state, ok(undefined)] }
    return mockRun(map)(empty)(program())
}

/**
 * What {@link jsPerform} answers, as text, or why there is none.
 *
 * @type {(performed: readonly [Vec, Result<unknown, unknown>]) => Result<string, string>}
 */
export const jsText = ([stdout, result]) =>
    result[0] === 'error' ? error(`the program failed: ${String(result[1])}`) : decode(u8ListMsb(stdout))

/** A program's standard output when performed in memory, as text. @type {(program: Sample['program']) => Result<string, string>} */
export const jsOutput = program => jsText(jsPerform(program))

/**
 * A run's answer from `sandbox`, or why there is none: an operation this page
 * could not perform, or a throw.
 *
 * @type {<T>(r: Result<SandboxResult<T>, IoChannel>) => Result<{ readonly value: T, readonly time: number }, string>}
 */
const timed = r => r[0] === 'error'
    ? error(errorMessage(r[1]))
    : r[1].result[0] === 'error'
        ? error(`it threw: ${String(r[1].result[1])}`)
        : ok({ value: r[1].result[1], time: r[1].duration })

/**
 * Performs the program in a `sandbox`, and decodes its output after: the time
 * holds the run alone, as the WebAssembly run's does.
 *
 * @type {(program: Sample['program']) => Effect<Sandbox, Result<Run, string>, never>}
 */
export const runJs = program => resultStep(sandbox(() => jsPerform(program)), r => {
    const t = timed(/** @type {Result<SandboxResult<readonly [Vec, Result<unknown, unknown>]>, IoChannel>} */ (r))
    /** @type {Result<Run, string>} */
    const run = t[0] === 'error' ? t : ok({ output: jsText(t[1].value), time: t[1].time })
    return pureOk(run)
})

/**
 * Loads the sample with its export, untimed, as the JavaScript run's module
 * was imported before it; then times `run_sample` alone, and reads back what
 * the sample wrote, one byte at a time. Each export answers `-1` for a
 * sample that threw, and `run_sample` otherwise the byte count.
 * The memory's size is read after the run, from its current buffer: a
 * memory that grows detaches the buffer it had, whose size then reads `0`.
 *
 * @type {(name: string) => (instance: WasmInstance) => Effect<Sandbox, Result<WasmRun, string>, never>}
 */
export const runWasm = name => ({ exports }) => {
    const load = exports[name]
    const runSample = exports['run_sample']
    const outputByte = exports['output_byte']
    const memory = /** @type {{ readonly buffer?: { readonly byteLength: number } } | undefined} */ (exports['memory'])
    if (typeof load !== 'function' || typeof runSample !== 'function' || typeof outputByte !== 'function' || memory?.buffer === undefined) {
        return pureOk(error(`the module does not export ${name}, run_sample, output_byte and memory`))
    }
    const live = /** @type {{ readonly buffer: { readonly byteLength: number } }} */ (memory)
    const loaded = resultStep(sandbox(() => /** @type {() => number} */ (load)()), r => {
        const t = timed(/** @type {Result<SandboxResult<number>, IoChannel>} */ (r))
        return pure(t[0] === 'error' ? t : t[1].value < 0 ? error('the sample threw while loading') : ok(null))
    })
    const ran = step(loaded, () => sandbox(() => /** @type {() => number} */ (runSample)()))
    return resultMapStep(ran, r => {
        /** @type {Result<{ readonly value: number, readonly time: number }, string>} */
        const t = r[0] === 'error' && typeof r[1] === 'string'
            ? error(r[1])
            : timed(/** @type {Result<SandboxResult<number>, IoChannel>} */ (r))
        /** @type {(value: number) => Result<string, string>} */
        const output = value => value < 0
            ? error('the sample threw')
            : decode(Array.from({ length: value }, (_, i) => /** @type {(i: number) => number} */ (outputByte)(i)))
        /** @type {Result<WasmRun, string>} */
        const run = t[0] === 'error' ? t : ok({ run: { output: output(t[1].value), time: t[1].time }, memory: live.buffer.byteLength })
        return ok(run)
    })
}

/**
 * Both runs, JavaScript first; the WebAssembly one only once the module has
 * loaded.
 *
 * @type {(sample: Sample) => (state: State) => Effect<Sandbox, State, never>}
 */
export const runBoth = ({ name, program }) => state => {
    const { wasm } = state
    const js = history(runJs(program))
    const both = historyStep(js, () => wasm[0] === 'ok'
        ? runWasm(name)(wasm[1])
        : pureOk(error(wasm[0] === 'loading' ? 'the module has not loaded yet' : wasm[1])))
    return step(both, ([wasmRun, jsRun]) => pureOk(/** @type {State} */ ({ ...state, runs: { js: jsRun, wasm: wasmRun } })))
}

/**
 * A time as the page shows it: to a tenth of a millisecond, which is finer
 * than most browsers let `performance.now()` measure.
 *
 * @type {(ms: number) => string}
 */
export const milliseconds = ms => `${ms.toFixed(1)} ms`

/** @type {<T>(value: Loaded<T>, show: (t: T) => readonly Node[]) => readonly Node[]} */
const loadedView = (value, show) => value[0] === 'loading'
    ? [['p', {}, 'Loading…']]
    : value[0] === 'ok' ? show(value[1]) : [refusal(value[1])]

/** @type {(label: string, value: string) => Element} */
const stat = (label, value) => ['p', {}, `${label}: ${value}`]

/** @type {(output: Result<string, string>) => readonly Node[]} */
const outputView = output => output[0] === 'ok'
    ? [caption('Standard output:'), ['div', { [codeMarker]: '' }, ['pre', output[1] === '' ? '(empty)' : output[1]]]]
    : [refusal(output[1])]

/**
 * How many times as long the WebAssembly run took as the JavaScript one, or
 * "Not available" where either failed or the JavaScript time reads `0`,
 * which a browser's coarse clock answers for a short run.
 *
 * @type {(runs: Runs) => string}
 */
export const ratio = ({ js, wasm }) => js[0] === 'ok' && wasm[0] === 'ok' && js[1].time > 0
    ? `${(wasm[1].run.time / js[1].time).toFixed(1)}×`
    : 'Not available'

/** @type {(runs: Runs) => readonly Node[]} */
const runsDetail = ({ js, wasm }) => [
    ['h3', {}, 'JavaScript'],
    ...(js[0] === 'ok'
        ? [
            ...outputView(js[1].output),
            stat('Running time', milliseconds(js[1].time)),
            stat('Memory', 'Not available'),
        ]
        : [refusal(js[1])]),
    ['h3', {}, 'WebAssembly'],
    ...(wasm[0] === 'ok'
        ? [
            ...outputView(wasm[1].run.output),
            stat('Running time', milliseconds(wasm[1].run.time)),
            stat('Linear memory after the run', `${wasm[1].memory} bytes`),
        ]
        : [refusal(wasm[1])]),
]

/** @type {(runs: Runs) => readonly Node[]} */
const runsView = runs => [
    ...runsDetail(runs),
    ['h3', {}, 'Comparison'],
    stat('WebAssembly running time, as a multiple of the JavaScript one', ratio(runs)),
]

/** @type {(state: State) => readonly Node[]} */
const startupView = ({ wasm }) => wasm[0] === 'ok'
    ? [stat('WebAssembly startup (fetch, compile and instantiate)', milliseconds(wasm[1].startup))]
    : []

/** @type {(name: string) => (state: State) => Element} */
export const view = name => state => ['div', {},
    ['p', {},
        'The same FunctionalScript program, run two ways: as the JavaScript it already is, ',
        'and compiled by ', ['code', 'fjs compile'], ' to Rust on the NaNVM runtime, then to WebAssembly. ',
        'Run calls each in turn and shows what it wrote to standard output and how long the call took.'],
    caption('FunctionalScript source:'),
    ...loadedView(state.source, text => [codeBlock(text, 'Copy the source', highlight(text))]),
    caption('Rust that fjs compile writes from it, on the NaNVM runtime:'),
    ...loadedView(state.rust, text => [codeBlock(text, 'Copy the Rust')]),
    caption('WebAssembly text (WAT) of the functions compiled from this source, without the NaNVM runtime:'),
    ...loadedView(state.wat, text => [['div', { [codeMarker]: '', [listingMarker]: '' }, ['pre', text]]]),
    ['p', {}, ['button', { type: 'button', name: 'run' }, 'Run']],
    ...startupView(state),
    ...(state.runs === null ? [] : runsView(state.runs)),
]

/** @type {(sample: Sample) => (state: State) => (event: DemoEvent) => Effect<FetchText | Instantiate | Sandbox, State, never>} */
export const update = sample => state => event =>
    event.kind === 'start' ? load(sample.name)
    : event.kind === 'click' && event.name === 'run' ? runBoth(sample)(state)
    : pureOk(state)

/** @type {(sample: Sample) => Demo<State, DemoEvent, FetchText | Instantiate | Sandbox>} */
export const wasmDemo = sample => ({ init, update: update(sample), view: view(sample.name) })
