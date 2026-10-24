/**
 * The state of a WASM demo page ([`./module.f.mjs`](./module.f.mjs)).
 *
 * @module
 */

import type { Write } from '../../../effects/common/types.ts'
import type { WasmInstance } from '../../../effects/browser/types.ts'
import type { Effect } from '../../../effects/types.ts'
import type { Result } from '../../../types/result/types.ts'

/**
 * Where a sample is: the name it is known by, which is also its module in
 * `nanvm-demos` and the export that loads it there; and the directory that
 * holds its `sample.f.js`, repository-relative — beside the generator for a
 * sample of its own, beside its page for a spec page's example.
 */
export type Place = {
    readonly name: string
    readonly directory: string
}

/** What one call did: answered a value, or threw one, each as `spell` writes it. */
export type Outcome = readonly['returned', string] | readonly['threw', string]

/** One call a function sample's page makes: the input, and what JavaScript answers. */
export type ListedCall = readonly [number, Outcome]

/**
 * A function sample's place, with the calls its page's Run button makes, in
 * order ([`../samples/module.f.mjs`](../samples/module.f.mjs)).
 */
export type FunctionPlace = Place & {
    readonly calls: readonly ListedCall[]
}

/** A sample: where it is, and the program itself, as the JavaScript run performs it. */
export type Sample = {
    readonly place: Place
    readonly program: () => Effect<Write, unknown, unknown>
}

/** A file the page loads: not yet, what it holds, or why there is nothing. */
export type Loaded<T> = readonly['loading'] | Result<T, string>

/**
 * One run: what the program wrote to standard output, as text, or why it is
 * not shown; and how long the entry call took, in milliseconds.
 */
export type Run = {
    readonly output: Result<string, string>
    readonly time: number
}

/** The JavaScript heap in use just before and just after a run, in bytes. */
export type JsHeap = {
    readonly before: number
    readonly after: number
}

/**
 * The JavaScript run, and the heap around it, or `null` in a browser that
 * does not report it: Chromium alone does.
 */
export type JsRun = Run & {
    readonly heap: JsHeap | null
}

/**
 * The WASM run, and the module's linear memory size after it, in bytes:
 * the size so far, since linear memory never shrinks, and every sample the
 * page has loaded shares it. `growth` is how much of it the run itself
 * added, from just before `run_sample` to just after.
 */
export type WasmRun = {
    readonly run: Run
    readonly memory: number
    readonly growth: number
}

/** Both runs of one press of Run, or why one could not happen. */
export type Runs = {
    readonly js: Result<JsRun, string>
    readonly wasm: Result<WasmRun, string>
}

export type State = {
    readonly source: Loaded<string>
    readonly rust: Loaded<string>
    readonly wat: Loaded<string>
    readonly wasm: Loaded<WasmInstance>
    readonly runs: Runs | null
}
