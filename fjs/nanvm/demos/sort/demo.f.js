/**
 * The sorting sample, run as JavaScript and as WebAssembly, to compare how
 * long each takes.
 *
 * @module
 *
 * @import { Sample } from '../page/types.ts'
 */

import program from './sample.f.js'
import { irPlace, wasmDemo } from '../page/module.f.js'
import { placeAt } from '../samples/module.f.js'

/**
 * The sample spells its bytes as a bare `bigint`, since `fjs compile` cannot
 * compile `fjs/types/bit_vec` yet; this is where it is read as the `Vec`
 * the `write` command carries. The IR route runs [`ir.f.js`](./ir.f.js).
 */
export const demo = wasmDemo({
    place: placeAt('fjs/nanvm/demos/sort'),
    program: /** @type {Sample['program']} */ (/** @type {unknown} */ (program)),
    ir: irPlace('sort'),
})
