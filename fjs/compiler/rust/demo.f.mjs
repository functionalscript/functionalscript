/**
 * A FunctionalScript module as the Rust `fjs compile` writes for it: type a
 * module, read the `nanvm-lib` calls that build its value.
 *
 * **It is the `.rs` output, not a lookalike.** The text is parsed and lowered
 * exactly as the compiler does, then printed by [`toRust`](./module.f.mjs); a
 * refusal — a parse error, or a shape Rust has no spelling for — is shown in
 * the compiler's own words rather than as an empty box, since what a stage
 * will not accept is half of what it is.
 *
 * **Modules with imports are refused, and say so.** A browser has no file set
 * to resolve them from, so the demo compiles one module over no files, and
 * `toRust` reports that the module reads its arguments.
 *
 * **It needs no operations.** Parsing, lowering and printing are pure
 * functions of the text, so `update` declares `never` and returns through
 * `pureOk`.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 */

import { parse } from '../transpiler/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { error } from '../../types/result/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'
import { examples } from '../examples/module.f.mjs'
import { toRust } from './module.f.mjs'

/**
 * `text` as Rust, or why it is not: the parser's message, or the printer's
 * refusal.
 *
 * @type {(text: string) => Result<string, string>}
 */
export const _rustOf = text => {
    const result = parse('')(text)
    return result[0] === 'error' ? error(result[1].message) : toRust(unresolved(result[1]).edag)
}

export const demo = textDemo({ name: 'rust', label: 'Source', init: examples[0][1], examples })(text => {
    const [kind, value] = _rustOf(text)
    return [kind === 'ok' ? ['pre', value] : ['p', `Refused: ${value}`]]
})
