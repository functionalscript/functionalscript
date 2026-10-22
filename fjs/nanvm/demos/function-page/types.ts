/**
 * The state of a function sample's WASM demo page
 * ([`./module.f.mjs`](./module.f.mjs)).
 *
 * @module
 */

import type { Node } from '../../../media/html/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { FunctionPlace, Outcome, State as PageState } from '../page/types.ts'

export type { Outcome }

/**
 * A sample whose default export is a function of a number, rather than a
 * program: where it is, with the calls Run makes, as the samples list
 * states them; and the function, as the JavaScript run calls it.
 */
export type FunctionSample = {
    readonly place: FunctionPlace
    readonly entry: (input: number) => unknown
}

/** One call: what it did, and how long one call took, in microseconds. */
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

/**
 * The files a WASM demo page loads, the source's graph drawn once it has
 * arrived, and the calls of the last press of Run.
 */
export type State = Omit<PageState, 'runs'> & {
    readonly edag: readonly Node[]
    readonly calls: readonly Calls[] | null
}
