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
 * The message the page proposes for the refusal: the reason, at the
 * `export` after the `throw`, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: 'a module ends in `throw` or in its exports, not both',
    width: 6,
    label: 'JavaScript never reaches this export: the module throws first',
    help: 'keep one ending, the export or the `throw` alone:',
    fix: 'export default 2;',
    note: 'refused by design, see spec/modules/throw-position/README.md',
}

/**
 * What JavaScript answers for `sample.mjs`: no default export, since the
 * import of the module throws. No FunctionalScript module imports the
 * sample, which is none: the host proof, `proof.mjs`, holds this to it.
 */
export const answer = 'none: importing it throws 1'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = 'throw 1;\nexport default 2;\n'

export const demo = refusedDemo({ directory: 'spec/modules/throw-position', answer, alternative, suggestion })
