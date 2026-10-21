/**
 * The state of a function sample's WASM demo page
 * ([`./module.f.mjs`](./module.f.mjs)).
 *
 * @module
 */

import type { Result } from '../../../types/result/types.ts'
import type { State as PageState } from '../page/types.ts'

/**
 * A sample whose default export is a function of a number, rather than a
 * program: the name it is known by, as a WASM demo sample's is; the
 * function, as the JavaScript run calls it; and the numbers Run calls it
 * with, in order.
 */
export type FunctionSample = {
    readonly name: string
    readonly entry: (input: number) => unknown
    readonly inputs: readonly number[]
}

/** What one call did: answered a value, or threw one, each as `String` spells it. */
export type Outcome = readonly['returned', string] | readonly['threw', string]

/** One call: what it did, and how long it took, in milliseconds. */
export type Call = {
    readonly outcome: Outcome
    readonly time: number
}

/** Both calls with one input, or why one could not happen. */
export type Calls = {
    readonly input: number
    readonly js: Result<Call, string>
    readonly wasm: Result<Call, string>
}

/** The files a WASM demo page loads, and the calls of the last press of Run. */
export type State = Omit<PageState, 'runs'> & {
    readonly calls: readonly Calls[] | null
}
