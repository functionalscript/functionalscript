/**
 * The "hello, world" sample, run as JavaScript and as WebAssembly.
 *
 * @module
 *
 * @import { Sample } from '../page/types.ts'
 */

import program from './sample.f.js'
import { wasmDemo } from '../page/module.f.mjs'

/**
 * The sample spells its bytes as a bare `bigint`, since `fjs compile` cannot
 * compile `fjs/types/bit_vec` yet; this is where it is read as the `Vec`
 * the `write` command carries.
 */
export const demo = wasmDemo({ name: 'hello', program: /** @type {Sample['program']} */ (/** @type {unknown} */ (program)) })
