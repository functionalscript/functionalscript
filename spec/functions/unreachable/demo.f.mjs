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
    message: "this statement never runs: nothing follows `return` in FunctionalScript",
    width: 5,
    label: "JavaScript never reaches this",
    help: "remove what follows the `return`:",
    fix: "    return 1;",
    note: "refused by design, see spec/functions/unreachable/README.md",
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
export const sample = "/** @type {() => number} */\nconst f = () => {\n    return 1;\n    const a = 2;\n};\nexport default f();\n"

export const demo = refusedDemo({ directory: 'spec/functions/unreachable', answer, alternative, suggestion })
