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
 * The page's JavaScript heap in use, in bytes: Chromium's non-standard
 * `performance.memory.usedJSHeapSize`, or `null` in a browser without it.
 * Chrome answers it to the byte; a build may round it or answer a cached
 * value instead, as Chromium's headless shell does, so a change may not show.
 * `performance.measureUserAgentSpecificMemory` is not used: it needs a
 * cross-origin isolated page, and answers only after a garbage collection.
 */
export type JsHeapSize = readonly['jsHeapSize', () => OpResult<number | null>]

/** Every browser operation. */
export type BrowserOp = FetchText | Instantiate | JsHeapSize
