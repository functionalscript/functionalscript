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
    message: "`Number` is a conversion: it takes exactly one operand",
    width: 6,
    label: "JavaScript ignores the `2` here",
    help: "convert one value:",
    fix: "export default Number(\"1\");",
    note: "refused by design, see spec/conversions/operands/README.md",
}

export const demo = refusedDemo({ directory: 'spec/conversions/operands', entry, alternative, suggestion })
