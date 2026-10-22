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
    message: "a key computed at run time is not FunctionalScript: it may name anything the value inherits",
    width: 1,
    label: "JavaScript reads whatever `i` names here, `\"constructor\"` included",
    help: "read an element with `a[Number(i)]`, or an own entry with `entry(a, i)` (spec/property-access/entries):",
    fix: "const at = (a, i) => a[Number(i)];",
    note: "refused by design, see spec/property-access/runtime-keys/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 'y'

export const demo = refusedDemo({ directory: 'spec/property-access/runtime-keys', answer, alternative, suggestion })
