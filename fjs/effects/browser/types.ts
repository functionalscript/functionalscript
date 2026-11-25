/**
 * Operations only a browser page performs: the ones a demo needs that
 * `effects/common` cannot hold, since Node answers none of them the same way. A
 * page fetches from the site it was served by, so a path here is the site's,
 * root-relative.
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'
import type { IoResult, OpResult } from '../types.ts'

/** Fetches a file from the site, as text. */
export type FetchText = readonly['fetchText', (path: string) => IoResult<string>]

/**
 * A WebAssembly module, instantiated: its exports, and how long getting
 * there took.
 */
export type WasmInstance = {
    /** The module's exports, by name: functions, and its memory. */
    readonly exports: StringMap<unknown>
    /**
     * Fetching, compiling and instantiating the module, in milliseconds, as
     * `performance.now()` measures it. A page reports it apart from any run.
     */
    readonly startup: number
}

/**
 * Fetches a WebAssembly module from the site, and instantiates it with no
 * imports.
 */
export type Instantiate = readonly['instantiate', (path: string) => IoResult<WasmInstance>]

/**
 * One call of an IR program on NaNVM L0: the value the export answered
 * (host-read), and the L0 module's linear memory size after the call and
 * how much it grew across it.
 */
export type IrCallResult = {
    readonly value: unknown
    readonly memory: number
    readonly growth: number
    /**
     * The export call alone (plus host read/drop of its answer), in
     * milliseconds — not host or program instantiation, which sit outside
     * this figure as sample load sits outside timed `run_sample` on the
     * Rust→WASM path.
     */
    readonly time: number
}

/**
 * An IR program ready to run: L0 and the emitted module compiled, bound
 * through NaNVM. `invoke` makes a fresh host, runs the named export, and
 * answers the host-read value with a `time` that covers the entry call
 * alone. Prefetched on page start so Run's startup line is compile only.
 */
export type IrInstance = {
    readonly invoke: () => IrCallResult
    /**
     * Fetching and compiling L0 and the program module, in milliseconds.
     * Host and program instantiation for one call are not included here;
     * they happen inside `invoke` before its timed export window.
     */
    readonly startup: number
}

/**
 * Fetches NaNVM L0 and an IR-emitted program module from the site, compiles
 * both, and binds them so a later `invoke` runs the named export on a fresh
 * host.
 */
export type InstantiateIr = readonly['instantiateIr', (l0Path: string, programPath: string, exportName: string) => IoResult<IrInstance>]

/**
 * The page's JavaScript heap in use, in bytes: Chromium's non-standard
 * `performance.memory.usedJSHeapSize`, or `null` in a browser without it.
 * Chrome answers it to the byte; a build may round it or answer a cached
 * value instead, as Chromium's headless shell does, so a change may not show.
 * `performance.measureUserAgentSpecificMemory` is not used: it needs a
 * cross-origin isolated page, and answers only after a garbage collection.
 */
export type JsHeapSize = readonly['jsHeapSize', () => OpResult<number | null>]

/** Every browser operation. */
export type BrowserOp = FetchText | Instantiate | InstantiateIr | JsHeapSize
