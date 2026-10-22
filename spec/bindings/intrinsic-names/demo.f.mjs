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
    message: "`String` names a built-in: FunctionalScript does not let a module rebind it",
    width: 6,
    label: "JavaScript shadows the global `String` here",
    help: "give the function a name of its own:",
    fix: "const s = x => \"s\" + x;",
    note: "refused by design, see spec/bindings/intrinsic-names/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 's1'

export const demo = refusedDemo({ directory: 'spec/bindings/intrinsic-names', answer, alternative, suggestion })
