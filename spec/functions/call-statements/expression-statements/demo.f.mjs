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
    message: "this statement does nothing: FunctionalScript admits a call here, not a value thrown away",
    width: 3,
    label: "JavaScript reads `o.x` here and discards it",
    help: "remove the statement, or bind the value with `const` and use it:",
    fix: "    return o.x + 1;",
    note: "refused by design, see spec/functions/call-statements/expression-statements/README.md",
}

export const demo = refusedDemo({ directory: 'spec/functions/call-statements/expression-statements', entry, alternative, suggestion })
