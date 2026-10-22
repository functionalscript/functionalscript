/**
 * The refused `in` of [`README.md`](./README.md): what `fjs compile` prints
 * for it, the message the page proposes it print instead, what JavaScript
 * answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../fjs/compiler/refused_demo/types.ts'
 */

import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for `in`: the reason, at the `in`, and the
 * alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: '`in` is not FunctionalScript: it asks a prototype chain, and there is none',
    width: 2,
    label: 'JavaScript answers `true` here, from `Object.prototype`',
    help: 'ask for an own entry with `hasEntry` (spec/property-access/entries):',
    fix: 'export default hasEntry({}, "toString");',
    note: 'refused by design, see spec/operators/in/README.md',
}

export const demo = refusedDemo({ directory: 'spec/operators/in', entry, alternative, suggestion })
