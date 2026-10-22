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
    message: "this statement never runs: nothing follows `return` in FunctionalScript",
    width: 5,
    label: "JavaScript never reaches this",
    help: "remove what follows the `return`:",
    fix: "    return 1;",
    note: "refused by design, see spec/functions/unreachable/README.md",
}

export const demo = refusedDemo({ directory: 'spec/functions/unreachable', entry, alternative, suggestion })
