/**
 * The example of [`README.md`](./README.md) (Comments) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `1` and `-42.5`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ name: 'comments', directory: 'spec/lexical/comments', entry: /** @type {(input: number) => unknown} */ (entry), inputs: [1, -42.5] })
