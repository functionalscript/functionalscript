/**
 * The example of [`README.md`](./README.md) (Shared Values, Constants) with every output
 * `fjs compile` makes of it, called as JavaScript and as WebAssembly with
 * `0` and `1`.
 *
 * @module
 */

import entry from './sample.f.js'
import { functionDemo } from '../../../fjs/nanvm/demos/function-page/module.f.mjs'

export const demo = functionDemo({ place: { name: 'constants', directory: 'spec/bindings/constants' }, entry: /** @type {(input: number) => unknown} */ (entry), inputs: [0, 1] })
