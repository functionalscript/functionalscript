/**
 * The example of [`README.md`](./README.md) (Calls) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `1` and `3`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'calls', directory: 'spec/functions/calls', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [1, 3] })
