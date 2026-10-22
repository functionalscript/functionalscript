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
    message: "`eval` is not FunctionalScript: it runs source text no compiler has read",
    width: 4,
    label: "JavaScript runs `\"1 + 1\"` here and answers `2`",
    help: "write the code itself, where the compiler can check it:",
    fix: "export default 1 + 1;",
    note: "refused by design, see spec/built-ins/eval/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = '2'

export const demo = refusedDemo({ directory: 'spec/built-ins/eval', answer, alternative, suggestion })
