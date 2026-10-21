/**
 * The example of [`README.md`](./README.md) (Bigints) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0`, `1` and `2`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'bigints', directory: 'spec/values/bigints', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [0, 1, 2] })
