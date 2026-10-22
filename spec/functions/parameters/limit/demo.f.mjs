/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../../fjs/compiler/refused_demo/types.ts'
 */

import alternative from './alternative.f.js'
import { refusedDemo } from '../../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "a 17th fixed parameter is not FunctionalScript: a function has at most 16",
    width: 1,
    label: "JavaScript binds the 17th argument here",
    help: "take many arguments with a rest parameter, or pass one object:",
    fix: "const f = (...p) => p[16];",
    note: "refused by design, see spec/functions/parameters/limit/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = '17'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = "/** @type {(...p: number[]) => number} */\nconst f = (a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q) => q;\nexport default f(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);\n"

export const demo = refusedDemo({ directory: 'spec/functions/parameters/limit', answer, alternative, suggestion })
