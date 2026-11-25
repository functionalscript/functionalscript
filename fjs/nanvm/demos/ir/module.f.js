/**
 * File names and program list for the IR / direct-to-WASM demo route: one
 * spelling for the emit script and the sort / Collatz pages.
 *
 * @module
 */

/** NaNVM L0 beside the IR modules. */
export const l0FileName = 'nanvm_l0_wasm.wasm'

/** @type {(name: string) => string} */
export const irFileName = name => `${name}.ir.wasm`

/**
 * The samples that have an `ir.f.js` and are emitted into the wasm publish
 * directory.
 *
 * @type {readonly string[]}
 */
export const irPrograms = /** @type {const} */ (['collatz', 'sort'])

/** The export every IR demo program answers. */
export const irExportName = 'run'
