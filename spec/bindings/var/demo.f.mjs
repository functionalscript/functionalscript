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
    message: "`var` is not FunctionalScript: a name is bound once, with `const`",
    width: 3,
    label: "JavaScript declares a variable here, hoisted to the top of its function",
    help: "bind the name with `const`:",
    fix: "const a = 1;",
    note: "refused by design, see spec/bindings/var/README.md",
}

export const demo = refusedDemo({ directory: 'spec/bindings/var', entry, alternative, suggestion })
