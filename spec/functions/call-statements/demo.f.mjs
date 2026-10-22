/**
 * The example of [`README.md`](./README.md) (Call Statements) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `2` and `5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'
import { functionPlaceAt } from '../../../fjs/nanvm/demos/samples/module.f.mjs'

export const demo = functionDemo({ place: functionPlaceAt('spec/functions/call-statements'), entry })
