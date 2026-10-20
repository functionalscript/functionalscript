/**
 * Operations only a browser page performs: the first two a demo needs that
 * `effects/common` cannot hold, since Node answers neither the same way. A
 * page fetches from the site it was served by, so a path here is the site's,
 * root-relative.
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'
import type { IoResult } from '../types.ts'

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

/** Every browser operation. */
export type BrowserOp = FetchText | Instantiate
