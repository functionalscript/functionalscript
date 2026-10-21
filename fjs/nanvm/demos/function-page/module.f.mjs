/**
 * The WASM demo page of a sample that is a function rather than a program
 * ([`todo/wasm-demos.md`](../../../../todo/wasm-demos.md)): a language spec
 * page's example, with every output `fjs compile` makes of it. It shows the
 * FunctionalScript source, the expression graph (EDAG) it lowers to, drawn
 * and as `fjs compile` writes it, the Rust it compiles to, and the
 * disassembly of the WebAssembly that Rust builds to. Its Run button calls the
 * default export with each of the sample's inputs, as JavaScript and then as
 * WebAssembly, and shows what each call answered or threw and how long it
 * took.
 *
 * **It is the program page's other half, not a copy of it.** It loads the
 * same four files with the same [`load`](../page/module.f.mjs), from the same
 * `nanvm-demos` module, and draws them with the same views. What differs is
 * the run: a program performs an effect and is read by what it wrote, where
 * a function is called with an argument and read by what it answers.
 *
 * **The EDAG is computed in the page, the Rust is fetched.** The graph and
 * its `.edag.data.js` are pure functions of the source, the ones the
 * compiler's own demos show, so the page computes them as those do. The Rust
 * is the committed `.rs` the WebAssembly was built from, so the disassembly
 * below it is that Rust's, whatever this build's compiler would write.
 *
 * **A throw is an answer here.** For a function whose discarded operand is
 * an assertion, as the comma's example is, the call that fails it is half of
 * what the page shows. So a call that throws is shown with what it threw,
 * and only a call that could not be made at all is a refusal.
 *
 * @module
 *
 * @import { Sandbox, SandboxResult } from '../../../effects/common/types.ts'
 * @import { FetchText, Instantiate, WasmInstance } from '../../../effects/browser/types.ts'
 * @import { Effect, IoChannel, Operation } from '../../../effects/types.ts'
 * @import { Element, Node } from '../../../media/html/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Demo, DemoEvent } from '../../../website/demo/types.ts'
 * @import { Call, Calls, FunctionSample, Outcome, State } from './types.ts'
 */

import { sandbox } from '../../../effects/common/module.f.mjs'
import { errorMessage, mapStep, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { compiled } from '../../../compiler/demo.f.mjs'
import { graphOfText } from '../../../compiler/edag/demo.f.mjs'
import { caption, refusal } from '../../../website/demo/module.f.mjs'
import { codeBlock } from '../../../website/demo/code/module.f.js'
import { graphSvg } from '../../../website/demo/graph/module.f.mjs'
import { codeOutput, highlight } from '../../../website/demo/highlight/module.f.mjs'
import { codeMarker, listingMarker } from '../../../website/style/module.f.js'
import { decode, load as loadFiles, loadedView, milliseconds, stat } from '../page/module.f.mjs'

/** @type {State} */
export const init = { source: ['loading'], rust: ['loading'], wat: ['loading'], wasm: ['loading'], calls: null }

/**
 * Fetches the files a WASM demo page shows, as {@link loadFiles} does.
 *
 * @type {(name: string) => Effect<FetchText | Instantiate, State, never>}
 */
export const load = name => mapStep(loadFiles(name), ({ source, rust, wat, wasm }) => ({ source, rust, wat, wasm, calls: null }))

/**
 * What `call_sample` answers for a call when no sample is loaded:
 * `i32::MIN`, which no text's length spells.
 */
export const notLoaded = -0x8000_0000

/**
 * A call's answer from `sandbox`: what it returned, or threw, with how long
 * it took; or why there is none, an operation this page could not perform.
 *
 * @type {<T>(r: Result<SandboxResult<T>, IoChannel>, outcome: (value: T) => Result<Outcome, string>) => Result<Call, string>}
 */
const timedCall = (r, outcome) => {
    if (r[0] === 'error') { return error(errorMessage(r[1])) }
    const { result, duration } = r[1]
    const o = result[0] === 'ok' ? outcome(result[1]) : ok(/** @type {Outcome} */ (['threw', String(result[1])]))
    return o[0] === 'error' ? o : ok({ outcome: o[1], time: duration })
}

/**
 * Calls the JavaScript function with `input`, in a `sandbox`, and spells its
 * answer with `String` inside it, as `call_sample` does inside its call.
 *
 * @type {(entry: FunctionSample['entry']) => (input: number) => Effect<Sandbox, Result<Call, string>, never>}
 */
export const callJs = entry => input => resultStep(sandbox(() => String(entry(input))), r => pureOk(timedCall(
    /** @type {Result<SandboxResult<string>, IoChannel>} */ (r),
    value => ok(['returned', value]))))

/**
 * The text `call_sample` kept, read back one byte at a time by
 * `output_byte`, as what the call did: its length where the call returned,
 * `-1 - length` where it threw.
 *
 * @type {(outputByte: (i: number) => number) => (status: number) => Result<Outcome, string>}
 */
export const wasmOutcome = outputByte => status => {
    if (status === notLoaded) { return error('no sample is loaded') }
    const length = status < 0 ? -1 - status : status
    const text = decode(Array.from({ length }, (_, i) => outputByte(i)))
    return text[0] === 'error' ? text : ok(status < 0 ? ['threw', text[1]] : ['returned', text[1]])
}

/**
 * Loads the sample with its export, untimed, as the JavaScript function was
 * imported before it is called; and answers the call of the sample loaded,
 * timing `call_sample` alone. Or why it cannot be called: an export missing,
 * or a sample that threw while loading.
 *
 * @type {(name: string) => (instance: WasmInstance) => Effect<Sandbox, Result<(input: number) => Effect<Sandbox, Result<Call, string>, never>, string>, never>}
 */
export const wasmCaller = name => ({ exports }) => {
    const loadSample = exports[name]
    const callSample = exports['call_sample']
    const outputByte = exports['output_byte']
    if (typeof loadSample !== 'function' || typeof callSample !== 'function' || typeof outputByte !== 'function') {
        return pureOk(error(`the module does not export ${name}, call_sample and output_byte`))
    }
    const outcome = wasmOutcome(/** @type {(i: number) => number} */ (outputByte))
    /** @type {(input: number) => Effect<Sandbox, Result<Call, string>, never>} */
    const call = input => resultStep(sandbox(() => /** @type {(input: number) => number} */ (callSample)(input)), r =>
        pureOk(timedCall(/** @type {Result<SandboxResult<number>, IoChannel>} */ (r), outcome)))
    return resultStep(sandbox(() => /** @type {() => number} */ (loadSample)()), r => {
        const loaded = /** @type {Result<SandboxResult<number>, IoChannel>} */ (r)
        return pureOk(loaded[0] === 'error' ? error(errorMessage(loaded[1]))
            : loaded[1].result[0] === 'error' ? error(`the module threw while loading: ${String(loaded[1].result[1])}`)
            : loaded[1].result[1] < 0 ? error('the sample threw while loading')
            : ok(call))
    })
}

/**
 * `f` of each input in turn, collected in order.
 *
 * @type {<O extends Operation, T>(inputs: readonly number[], f: (input: number) => Effect<O, T, never>) => Effect<O, readonly T[], never>}
 */
const each = (inputs, f) => inputs.length === 0
    ? pureOk([])
    : step(f(inputs[0]), first => mapStep(each(inputs.slice(1), f), rest => [first, ...rest]))

/**
 * Calls the sample with each input, as JavaScript and then as WebAssembly;
 * the WebAssembly calls only once the module has loaded the sample.
 *
 * @type {(sample: FunctionSample) => (state: State) => Effect<Sandbox, State, never>}
 */
export const runCalls = ({ name, entry, inputs }) => state => {
    const { wasm } = state
    const caller = wasm[0] === 'ok'
        ? wasmCaller(name)(wasm[1])
        : pureOk(error(wasm[0] === 'loading' ? 'the module has not loaded yet' : wasm[1]))
    return step(caller, c => mapStep(
        each(inputs, input => step(callJs(entry)(input), js => mapStep(
            c[0] === 'ok' ? c[1](input) : pureOk(c),
            /** @type {(wasm: Result<Call, string>) => Calls} */ (w => ({ input, js, wasm: w }))))),
        calls => ({ ...state, calls })))
}

/** What a call did, as a sentence. @type {(outcome: Outcome) => string} */
export const outcomeText = ([kind, text]) => `${kind === 'returned' ? 'Returned' : 'Threw'} ${text}`

/** @type {(call: Call) => readonly Node[]} */
const madeView = ({ outcome, time }) => [
    ['div', { [codeMarker]: '' }, ['pre', outcomeText(outcome)]],
    stat('Running time', milliseconds(time)),
]

/** @type {(title: string, call: Result<Call, string>) => readonly Node[]} */
const callView = (title, call) => [
    ['h3', {}, title],
    ...(call[0] === 'ok' ? madeView(call[1]) : [refusal(call[1])]),
]

/**
 * Whether both calls did the same: returned the same text, or threw it.
 * Calls that could not be made are no comparison.
 *
 * @type {(calls: Calls) => string}
 */
export const agreement = ({ js, wasm }) => js[0] === 'ok' && wasm[0] === 'ok'
    ? js[1].outcome[0] === wasm[1].outcome[0] && js[1].outcome[1] === wasm[1].outcome[1] ? 'Yes' : 'No'
    : 'Not available'

/** @type {(calls: Calls) => readonly Node[]} */
const callsView = calls => [
    ['h3', {}, ['code', `default(${calls.input})`]],
    ...callView('JavaScript', calls.js),
    ...callView('WebAssembly', calls.wasm),
    stat('The same answer both ways', agreement(calls)),
]

/** @type {(text: string) => readonly Node[]} */
const edagView = text => {
    const graph = graphOfText(text)
    return [
        caption('Expression graph (EDAG) that fjs compile lowers it to:'),
        graph[0] === 'ok' ? graphSvg(graph[1]) : refusal(graph[1]),
        ...codeOutput('The same graph, as fjs compile writes it to a .edag.data.js file:', 'Copy the EDAG')(compiled(text)('output.edag.data.js')),
    ]
}

/** @type {(state: State) => readonly Node[]} */
const startupView = ({ wasm }) => wasm[0] === 'ok'
    ? [stat('WebAssembly startup (fetch, compile and instantiate)', milliseconds(wasm[1].startup))]
    : []

/** @type {(inputs: readonly number[]) => (state: State) => Element} */
export const view = inputs => state => ['div', {},
    ['p', {},
        'A FunctionalScript module and what fjs compile makes of it: the expression graph it lowers to, ',
        'the Rust it compiles to on the NaNVM runtime, and the WebAssembly that Rust builds to. ',
        `Run calls its default export with ${inputs.join(', then ')}, `,
        'first as the JavaScript it already is and then as WebAssembly, ',
        'and shows what each call returned or threw and how long it took.'],
    caption('FunctionalScript source:'),
    ...loadedView(state.source, text => [codeBlock(text, 'Copy the source', highlight(text)), ...edagView(text)]),
    caption('Rust that fjs compile writes from it, on the NaNVM runtime:'),
    ...loadedView(state.rust, text => [codeBlock(text, 'Copy the Rust')]),
    caption('WebAssembly text (WAT) of the functions compiled from this source, without the NaNVM runtime:'),
    ...loadedView(state.wat, text => [['div', { [codeMarker]: '', [listingMarker]: '' }, ['pre', text]]]),
    ['p', {}, ['button', { type: 'button', name: 'run' }, 'Run']],
    ...startupView(state),
    ...(state.calls === null ? [] : state.calls.flatMap(callsView)),
]

/** @type {(sample: FunctionSample) => (state: State) => (event: DemoEvent) => Effect<FetchText | Instantiate | Sandbox, State, never>} */
export const update = sample => state => event =>
    event.kind === 'start' ? load(sample.name)
    : event.kind === 'click' && event.name === 'run' ? runCalls(sample)(state)
    : pureOk(state)

/** @type {(sample: FunctionSample) => Demo<State, DemoEvent, FetchText | Instantiate | Sandbox>} */
export const functionDemo = sample => ({ init, update: update(sample), view: view(sample.inputs) })
