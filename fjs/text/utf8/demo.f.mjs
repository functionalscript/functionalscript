/**
 * UTF-8 as you type: a text field, and the bytes this module encodes each of
 * its code points to.
 *
 * **One line per code point**, because that is the unit UTF-8 works in: `h` is
 * one byte, `é` two, `€` three, `😀` four, and the lead byte's high bits say
 * which. Seeing them side by side is what the byte-format table in
 * `module.f.mjs` describes.
 *
 * **The bytes are shown in hex, and said to be**, because a reader can check
 * them: `printf '%s' 'hé€😀' | od -An -tx1` prints the same bytes in the same
 * order.
 *
 * **What UTF-8 cannot encode is refused, not shown as bytes.** A JavaScript
 * string can hold half of a surrogate pair on its own, and no UTF-8 sequence
 * encodes a surrogate. Such a line names the surrogate and says so, rather
 * than printing the bytes `fromCodePointList` answers for it, which are not
 * UTF-8 ([utf16-error-tag](./todo/utf16-error-tag.md)).
 *
 * **It needs no operations.** Encoding is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { CodePoint } from '../code_point/types.ts'
 */

import { fromCodePointList } from './module.f.mjs'
import { stringToCodePointList } from '../utf16/module.f.mjs'
import { errorMask, isValidCodePoint } from '../code_point/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { textDemo, caption } from '../../website/demo/module.f.mjs'

/** @type {(bytes: readonly number[]) => string} */
const hex = bytes => bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')

/**
 * A code point as Unicode writes it: `U+`, then at least four upper-case hex
 * digits.
 *
 * @type {(cp: CodePoint) => string}
 */
const unicode = cp => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

/**
 * One code point's line: the code point, then its UTF-8 bytes in hex.
 *
 * A code point that is not valid is an unpaired surrogate: a JavaScript
 * string's code units are all in `0x0000`–`0xFFFF`, so a surrogate is the only
 * invalid value `stringToCodePointList` can tag with `errorMask`, and removing
 * the tag gives the surrogate back.
 *
 * @type {(cp: CodePoint) => string}
 */
const line = cp => isValidCodePoint(cp)
    ? `${unicode(cp).padEnd(8)} ${hex(toArray(fromCodePointList([cp])))}`
    : `${unicode(cp ^ errorMask).padEnd(8)} error: unpaired surrogate, no UTF-8`

/**
 * One line per code point of `text`: the code point, then its UTF-8 bytes in
 * hex, or why it has none.
 *
 * @type {(text: string) => string}
 */
export const codePoints = text => toArray(stringToCodePointList(text))
    .map(line)
    .join('\n')

/**
 * The state is the text itself, not its bytes: the bytes are a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * The initial text has one code point of each UTF-8 length, so the first
 * thing a reader sees is all four sequence lengths.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    intro: 'Encodes text as UTF-8, one code point per line. Each line shows the code point and its bytes in hexadecimal; the initial text shows all four byte lengths.',
    name: 'text',
    label: 'Text',
    rows: 2,
    init: 'hé€😀',
})(text => [
    caption('Code points, UTF-8 hex:'),
    ['pre', codePoints(text)],
])
