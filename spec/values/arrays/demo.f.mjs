/**
 * The example of [`README.md`](./README.md) (Arrays) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `1` and `2`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'arrays', directory: 'spec/values/arrays', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [1, 2] })
