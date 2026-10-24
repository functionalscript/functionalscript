/**
 * The sorting sample, run as JavaScript and as WebAssembly, to compare how
 * long each takes.
 *
 * @module
 *
 * @import { Sample } from '../page/types.ts'
 */

import program from './sample.f.js'
import { wasmDemo } from '../page/module.f.mjs'
import { placeAt } from '../samples/module.f.mjs'

/**
 * The sample spells its bytes as a bare `bigint`, since `fjs compile` cannot
 * compile `fjs/types/bit_vec` yet; this is where it is read as the `Vec`
 * the `write` command carries.
 */
export const demo = wasmDemo({ place: placeAt('fjs/nanvm/demos/sort'), program: /** @type {Sample['program']} */ (/** @type {unknown} */ (program)) })
