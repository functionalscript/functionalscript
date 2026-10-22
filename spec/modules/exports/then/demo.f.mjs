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
    message: "`then` is reserved as an export: JavaScript treats a module that exports it as a promise",
    width: 4,
    label: "`await import()` of this module reads `then` here",
    help: "export the value under another name:",
    fix: "export const next = 1;",
    note: "refused by design, see spec/modules/exports/then/README.md",
}

export const demo = refusedDemo({ directory: 'spec/modules/exports/then', entry, alternative, suggestion })
