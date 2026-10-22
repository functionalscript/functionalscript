/**
 * The example of [`README.md`](./README.md) (Bodies and Guards) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `-5`, `0` and `7`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'guards', directory: 'spec/control-flow/guards' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [-5, 0, 7] })
