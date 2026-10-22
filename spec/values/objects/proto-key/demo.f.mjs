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
    message: "a `__proto__:` key is not FunctionalScript: JavaScript makes it the prototype, not a property",
    width: 9,
    label: "JavaScript makes `[]` the prototype here, so the object is an `Array`",
    help: "for a property named `__proto__`, write the computed key:",
    fix: "export default { [\"__proto__\"]: [] } instanceof Array;",
    note: "refused by design, see spec/values/objects/proto-key/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 'true'

export const demo = refusedDemo({ directory: 'spec/values/objects/proto-key', answer, alternative, suggestion })
