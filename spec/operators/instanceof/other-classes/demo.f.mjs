/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../../fjs/compiler/refused_demo/types.ts'
 */

import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "`instanceof` takes only `Array`: FunctionalScript has no other classes",
    width: 10,
    label: "JavaScript walks the prototype chain of `[]` for `Map.prototype` here",
    help: "ask whether a value is an array with `instanceof Array`:",
    fix: "export default [] instanceof Array;",
    note: "refused by design, see spec/operators/instanceof/other-classes/README.md",
}

export const demo = refusedDemo({ directory: 'spec/operators/instanceof/other-classes', entry, alternative, suggestion })
