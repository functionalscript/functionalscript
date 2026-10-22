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
    message: "nothing follows `export default` in a FunctionalScript module",
    width: 6,
    label: "JavaScript exports `a` after the default here",
    help: "move `export default` to the end of the module:",
    fix: "export default 1;",
    note: "refused by design, see spec/modules/export-after-default/README.md",
}

export const demo = refusedDemo({ directory: 'spec/modules/export-after-default', entry, alternative, suggestion })
