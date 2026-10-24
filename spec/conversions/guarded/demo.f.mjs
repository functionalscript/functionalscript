/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../fjs/compiler/refused_demo/types.ts'
 */

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

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = '1'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = "export default Number?.(\"1\");\n"

export const demo = refusedDemo({ directory: 'spec/conversions/guarded', answer, alternative, suggestion })
