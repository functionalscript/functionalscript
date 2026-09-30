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
 * them: `printf '%s' 'hé€😀' | od -An -tx1` prints the same bytes as the last
 * line.
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
import { toArray } from '../../types/list/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

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
 * One line per code point of `text`: the code point, then its UTF-8 bytes in
 * hex.
 *
 * @type {(text: string) => string}
 */
export const codePoints = text => toArray(stringToCodePointList(text))
    .map(cp => `${unicode(cp).padEnd(8)} ${hex(toArray(fromCodePointList([cp])))}`)
    .join('\n')

/**
 * All of `text`'s UTF-8 bytes in hex, the way `od -An -tx1` prints them.
 *
 * @type {(text: string) => string}
 */
export const bytes = text =>
    hex(toArray(fromCodePointList(stringToCodePointList(text))))

/**
 * The state is the text itself, not its bytes: the bytes are a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * The initial text has one code point of each length, so the first thing a
 * reader sees is all four sequence shapes.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    name: 'text',
    label: 'Text',
    rows: 2,
    init: 'hé€😀',
})(text => [
    ['p', 'Code points, UTF-8 hex:'],
    ['pre', codePoints(text)],
    ['p', 'All bytes, hex:'],
    ['pre', bytes(text)],
])
