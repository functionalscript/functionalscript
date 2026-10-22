/**
 * The example of [`README.md`](./README.md) (Function Outputs) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0` and `2`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'function_outputs', directory: 'spec/functions/function-outputs' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [0, 2] })
