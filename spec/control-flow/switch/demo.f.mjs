/**
 * The example of [`README.md`](./README.md) (Switch) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0`, `1`, `2` and `3`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'switch_statement', directory: 'spec/control-flow/switch' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [0, 1, 2, 3] })
