/**
 * The example of [`README.md`](./README.md) (Number Conversion) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `7` and `0.5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'number_conversion', directory: 'spec/conversions/number' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [7, 0.5] })
