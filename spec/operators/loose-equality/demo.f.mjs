/**
 * The refused construct of [`README.md`](./README.md): what `fjs compile`
 * prints for it, the message the page proposes it print instead, what
 * JavaScript answers for the same module, and the FunctionalScript spelling.
 *
 * @module
 *
 * @import { Suggestion } from '../../../fjs/compiler/refused_demo/types.ts'
 */

import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { refusedDemo } from '../../../fjs/compiler/refused_demo/module.f.mjs'

/**
 * The message the page proposes for the refusal: the reason, at the refused
 * token, and the alternative's line.
 *
 * @type {Suggestion}
 */
export const suggestion = {
    message: "`==` is not FunctionalScript: it converts its operands by rules that depend on both types",
    width: 2,
    label: "JavaScript converts `\"\"` to `0` here and answers `true`",
    help: "compare with `===`, and write the conversion you mean, `Number(b)` or `String(a)`:",
    fix: "const same = (a, b) => a === Number(b);",
    note: "refused by design, see spec/operators/loose-equality/README.md",
}

export const demo = refusedDemo({ directory: 'spec/operators/loose-equality', entry, alternative, suggestion })
