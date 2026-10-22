/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../../fjs/compiler/refused_demo/types.ts'
 */

import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "`\\'` is not an escape of a double-quoted string: FunctionalScript keeps those JSON strings",
    width: 4,
    label: "JavaScript reads this as `\"'\"`",
    help: "write the apostrophe as itself:",
    fix: "export default \"'\";",
    note: "refused by design, see spec/values/strings/apostrophe-escape/README.md",
}

export const demo = refusedDemo({ directory: 'spec/values/strings/apostrophe-escape', entry, alternative, suggestion })
