/**
 * The example of [`README.md`](./README.md) (Numbers) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0`, `1`, `2` and `3`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'
import { functionPlaceAt } from '../../../fjs/nanvm/demos/samples/module.f.mjs'

export const demo = functionDemo({ place: functionPlaceAt('spec/values/numbers'), entry })
