/**
 * The example of [`README.md`](./README.md) (Call Statements) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `2` and `5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'call_statements', directory: 'spec/functions/call-statements', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [2, 5] })
