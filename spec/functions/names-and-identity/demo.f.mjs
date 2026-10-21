/**
 * The example of [`README.md`](./README.md) (Names and Identity) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0` and `1`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'names_and_identity', directory: 'spec/functions/names-and-identity', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [0, 1] })
