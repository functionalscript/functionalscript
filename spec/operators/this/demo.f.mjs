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
    message: "`this` is not FunctionalScript: a function's inputs are its parameters",
    width: 4,
    label: "JavaScript answers by how the code is called; at module level, `undefined`",
    help: "pass the value as a parameter:",
    fix: "const get = o => o.n;",
    note: "refused by design, see spec/operators/this/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 'undefined'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = "export default typeof this;\n"

export const demo = refusedDemo({ directory: 'spec/operators/this', answer, alternative, suggestion })
