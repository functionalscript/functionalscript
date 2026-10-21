/**
 * The comma operator's example
 * ([`spec/operators/comma.md`](../../../../spec/operators/comma.md)) with
 * every output `fjs compile` makes of it, called as JavaScript and as
 * WebAssembly: with `1`, where its assertion holds, and with `-1`, where it
 * fails.
 *
 * @module
 */

import entry from './sample.f.mjs'
import { functionDemo } from '../function-page/module.f.mjs'

export const demo = functionDemo({ name: 'comma', entry, inputs: [1, -1] })
