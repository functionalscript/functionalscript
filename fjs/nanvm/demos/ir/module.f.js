/**
 * Paths and program names for the IR / direct-to-WASM demo route: the
 * emit script writes these under `nanvm/demos/wasm/`, and the sort and
 * Collatz pages load them beside Rust→WASM.
 *
 * @module
 */

import { buildDirectory } from '../page/module.f.js'

/** NaNVM L0 beside the IR modules. */
export const l0FileName = 'nanvm_l0_wasm.wasm'

/** @type {(name: string) => string} */
export const irFileName = name => `${name}.ir.wasm`

/**
 * The samples that have an `ir.f.js` and are emitted into
 * {@link buildDirectory}.
 *
 * @type {readonly string[]}
 */
export const irPrograms = /** @type {const} */ (['collatz', 'sort'])

/** Repository-relative publish directory for IR artifacts. */
export const irPublishDirectory = buildDirectory

/** @type {(name: string) => string} */
export const irPublishPath = name => `${irPublishDirectory}/${irFileName(name)}`

/** Repository-relative path of the published NaNVM L0 module. */
export const irL0PublishPath = `${irPublishDirectory}/${l0FileName}`
