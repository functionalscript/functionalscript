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
    message: "`Math` is not bound: a FunctionalScript module reads only what it binds or imports",
    width: 4,
    label: "JavaScript reads the global `Math` here",
    help: "write the function, or import it from a module:",
    fix: "const max = (a, b) => a < b ? b : a;",
    note: "refused by design, see spec/bindings/globals/README.md",
}

export const demo = refusedDemo({ directory: 'spec/bindings/globals', entry, alternative, suggestion })
