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
    message: "this module exports nothing: a FunctionalScript module answers its exports",
    width: 1,
    label: "JavaScript loads a module nothing can read here",
    help: "export what the module computes:",
    fix: "export default a;",
    note: "refused by design, see spec/modules/no-export/README.md",
}

/** The sample's default export, which it does not have: `undefined`. */
const entry = /** @type {{ readonly default?: unknown }} */ (sample).default

export const demo = refusedDemo({ directory: 'spec/modules/no-export', entry, alternative, suggestion })
