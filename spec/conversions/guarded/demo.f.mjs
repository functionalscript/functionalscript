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
    message: "`Number` is a conversion, not a value: there is nothing to guard",
    width: 6,
    label: "JavaScript checks the global `Number` for `null` here",
    help: "write the conversion without the guard:",
    fix: "export default Number(\"1\");",
    note: "refused by design, see spec/conversions/guarded/README.md",
}

export const demo = refusedDemo({ directory: 'spec/conversions/guarded', entry, alternative, suggestion })
