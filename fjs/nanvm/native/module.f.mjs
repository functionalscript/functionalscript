/**
 * What NaNVM's native static functions share with the represented
 * interpreter, as Rust, for `nanvm-lib`.
 *
 * `Object.entries` has no body to render, so its text, what
 * `String(Object.entries)` answers, is one constant both executors answer:
 * [`entriesText`](../../edag/value/entries/module.f.mjs), which the
 * interpreter answers and this module prints for the function
 * `vm/runtime.rs` creates, rather than written twice.
 *
 * @module
 */

import { entriesText } from '../../edag/value/entries/module.f.mjs'
import { stringLiteral } from '../../media/rust/module.f.mjs'
import { generatedHeader } from '../../media/rust/item/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'

/**
 * Where {@link generate}'s output goes, relative to the repository root:
 * beside `runtime.rs`, which includes it by `#[path]`.
 *
 * @type {string}
 */
export const path = 'nanvm/lib/src/vm/gen.native.rs'

/**
 * The text as one Rust constant. It is authored source, so a text Rust
 * cannot spell is a defect here and throws.
 *
 * @type {() => string}
 */
export const generate = () => [
    generatedHeader(
        '`npm run gen` from `fjs/nanvm/native/module.f.mjs`',
        '`entriesText` in `fjs/edag/value/entries/module.f.mjs` is the source'),
    '',
    '/// `String(Object.entries)`: the text of the function no body defines.',
    `pub const ENTRIES_TEXT: &str = ${unwrap(stringLiteral(entriesText))};`,
    '',
].join('\n')
