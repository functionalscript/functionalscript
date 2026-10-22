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
 * `import`, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: 'imports come first in a FunctionalScript module',
    width: 6,
    label: 'JavaScript hoists this import above the export',
    help: 'move the import to the top of the module:',
    fix: 'import b from "./a.f.js";',
    note: 'refused by design, see spec/modules/import-after-export/README.md',
}

/**
 * What JavaScript answers for `sample.mjs`, its default export as `String`
 * spells it. No FunctionalScript module imports the sample, which is none:
 * the host proof, `proof.mjs`, holds this to it.
 */
export const answer = '1,1'

/**
 * The text of `sample.mjs`, which the proof pins what `fjs compile` prints
 * for. The host proof, `proof.mjs`, holds it to the file.
 */
export const sample = 'export const a = 1;\nimport b from "./a.f.js";\nexport default [a, b];\n'

export const demo = refusedDemo({ directory: 'spec/modules/import-after-export', answer, alternative, suggestion })
