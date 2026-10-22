/**
 * The example of [`README.md`](./README.md) (Parameters) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `1` and `4`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'parameters', directory: 'spec/functions/parameters' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [1, 4] })
