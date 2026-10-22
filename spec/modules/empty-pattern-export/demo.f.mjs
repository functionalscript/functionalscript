/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../fjs/compiler/refused_demo/types.ts'
 */

import * as sample from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "this pattern binds no name, so the module exports nothing",
    width: 6,
    label: "JavaScript exports no name here",
    help: "export a name:",
    fix: "export const a = 1;",
    note: "refused by design, see spec/modules/empty-pattern-export/README.md",
}

/** The sample's default export, which it does not have: `undefined`. */
const entry = /** @type {{ readonly default?: unknown }} */ (sample).default

export const demo = refusedDemo({ directory: 'spec/modules/empty-pattern-export', entry, alternative, suggestion })
