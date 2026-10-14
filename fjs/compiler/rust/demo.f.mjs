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
 * **The output is copyable**: it is a document or generated source a reader
 * can save and use elsewhere. Copy keeps the original output text.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Marked } from '../../text/marked/types.ts'
 */

import { unresolved } from '../edag/module.f.mjs'
import { codeOutput } from '../../website/demo/highlight/module.f.mjs'
import { parsed, stageDemo } from '../stage_demo/module.f.mjs'
import { toRustMarked } from './module.f.mjs'

/**
 * `text` as Rust, or why it is not: the parser's message, or the printer's
 * refusal.
 *
 * @type {(text: string) => Result<Marked, string>}
 */
export const _rustOf = parsed(ast => toRustMarked(unresolved(ast).edag))

export const demo = stageDemo({
    intro: 'Compiles a FunctionalScript module without imports into Rust calls that build its value in NaNVM. Compare the output with the .rs module written by fjs compile.',
    name: 'rust',
})(text => codeOutput('Rust module:', 'Copy Rust module')(_rustOf(text)))
