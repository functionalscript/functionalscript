/**
 * The comma operator's example
 * ([`README.md`](./README.md)) with
 * every output `fjs compile` makes of it, called as JavaScript and as
 * WebAssembly: with `1`, where its assertion holds, and with `-1`, where it
 * fails.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'
import { functionPlaceAt } from '../../../fjs/nanvm/demos/samples/module.f.mjs'

export const demo = functionDemo({ place: functionPlaceAt('spec/operators/comma'), entry })
