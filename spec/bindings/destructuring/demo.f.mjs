/**
 * The example of [`README.md`](./README.md) (Destructuring) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `1` and `5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'
import { functionPlaceAt } from '../../../fjs/nanvm/demos/samples/module.f.mjs'

export const demo = functionDemo({ place: functionPlaceAt('spec/bindings/destructuring'), entry })
