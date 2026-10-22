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
    message: "`this` is not FunctionalScript: a function's inputs are its parameters",
    width: 4,
    label: "JavaScript answers by how the code is called; at module level, `undefined`",
    help: "pass the value as a parameter:",
    fix: "const get = o => o.n;",
    note: "refused by design, see spec/operators/this/README.md",
}

export const demo = refusedDemo({ directory: 'spec/operators/this', entry, alternative, suggestion })
