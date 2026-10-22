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
    message: "a `default` before a `case` is not FunctionalScript: the `default` is written last",
    width: 7,
    label: "JavaScript still tries `case 1` before this",
    help: "move the `default` after the last `case`:",
    fix: "        default: { return \"many\"; }",
    note: "refused by design, see spec/control-flow/switch/default-position/README.md",
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 'one'

export const demo = refusedDemo({ directory: 'spec/control-flow/switch/default-position', answer, alternative, suggestion })
