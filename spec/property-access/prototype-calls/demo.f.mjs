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
    message: "`hasOwnProperty` is a prototype's method: FunctionalScript has no prototype chain to find it on",
    width: 14,
    label: "JavaScript calls `Object.prototype.hasOwnProperty` here",
    help: "ask whether a value owns an entry with the `hasEntry` helper (spec/property-access/entries):",
    fix: "export default hasEntry({ a: 1 }, \"a\");",
    note: "refused by design, see spec/property-access/prototype-calls/README.md",
}

export const demo = refusedDemo({ directory: 'spec/property-access/prototype-calls', entry, alternative, suggestion })
