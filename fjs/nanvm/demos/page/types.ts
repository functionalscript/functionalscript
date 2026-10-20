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
 * A sample: the name it is known by, which is also its directory beside the
 * generator, its module in `nanvm-demos` and the export that runs it there;
 * and the program itself, as the JavaScript run performs it.
 */
export type Sample = {
    readonly name: string
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

/** The WASM run, and the module's linear memory size after it, in bytes. */
export type WasmRun = {
    readonly run: Run
    readonly memory: number
}

/** Both runs of one press of Run, or why one could not happen. */
export type Runs = {
    readonly js: Result<Run, string>
    readonly wasm: Result<WasmRun, string>
}

export type State = {
    readonly source: Loaded<string>
    readonly rust: Loaded<string>
    readonly wat: Loaded<string>
    readonly wasm: Loaded<WasmInstance>
    readonly runs: Runs | null
}
