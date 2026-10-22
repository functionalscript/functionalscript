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
    message: "a 17th fixed parameter is not FunctionalScript: a function has at most 16",
    width: 1,
    label: "JavaScript binds the 17th argument here",
    help: "take many arguments with a rest parameter, or pass one object:",
    fix: "const f = (...p) => p[16];",
    note: "refused by design, see spec/functions/parameters/limit/README.md",
}

export const demo = refusedDemo({ directory: 'spec/functions/parameters/limit', entry, alternative, suggestion })
