/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../fjs/compiler/refused_demo/types.ts'
 */

import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "`toString` is a prototype's name: FunctionalScript reads only what a value owns",
    width: 8,
    label: "JavaScript finds a function on `Object.prototype` here",
    help: "read an own entry with the `entry` helper (spec/property-access/entries):",
    fix: "export default typeof entry({}, \"toString\");",
    note: "refused by design, see spec/property-access/prototype-names/README.md",
}

export const demo = refusedDemo({ directory: 'spec/property-access/prototype-names', entry, alternative, suggestion })
