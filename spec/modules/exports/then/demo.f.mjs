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
    message: "`then` is reserved as an export: JavaScript treats a module that exports a function `then` as a promise",
    width: 4,
    label: "`await import()` of this module calls this and answers `1`, not the module",
    help: "export the value under another name:",
    fix: "export const next = resolve => resolve(1);",
    note: "refused by design, see spec/modules/exports/then/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = '0'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = "/** @type {(resolve: (value: number) => void) => void} */\nexport const then = resolve => resolve(1);\nexport default 0;\n"

export const demo = refusedDemo({ directory: 'spec/modules/exports/then', answer, alternative, suggestion })
