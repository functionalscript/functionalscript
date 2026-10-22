/**
 * The refused `in` of [`README.md`](./README.md): what `fjs compile` prints
 * for it, and what JavaScript answers for the same module.
 *
 * @module
 */

import entry from './sample.mjs'
import { refusedDemo } from '../../../fjs/compiler/refused_demo/module.f.mjs'

export const demo = refusedDemo({ directory: 'spec/operators/in', entry })
