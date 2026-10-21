/**
 * The example of [`README.md`](./README.md) (String Conversion) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `42` and `-0.5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'string_conversion', directory: 'spec/conversions/string', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [42, -0.5] })
