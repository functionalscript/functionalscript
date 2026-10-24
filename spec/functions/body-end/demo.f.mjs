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
    message: "this body does not end in `return` or `throw`: FunctionalScript writes what a function answers",
    width: 1,
    label: "JavaScript answers `undefined` when the block ends here",
    help: "end the block with what the function answers:",
    fix: "    return undefined;",
    note: "refused by design, see spec/functions/body-end/README.md",
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
export const sample = "/** @type {() => undefined} */\nconst f = () => {};\nexport default f();\n"

export const demo = refusedDemo({ directory: 'spec/functions/body-end', answer, alternative, suggestion })
