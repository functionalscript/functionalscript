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
 * **It needs no operations.** Encoding is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
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
 * The texts the examples drop-down offers, each named for what it shows.
 *
 * The first has one code point of each UTF-8 length. The last three are one
 * visible symbol each, but several code points: what a reader sees as one
 * character is the font's doing, not the encoding's. They are written with
 * escapes because most of their code points are invisible — the zero-width
 * joiner `U+200D`, the variation selector `U+FE0F`, and the tag letters
 * `U+E0061`–`U+E007A` that spell the flag's region, `gbeng`, ending with the
 * cancel tag `U+E007F`.
 *
 * @type {Examples}
 */
export const examples = [
    ['1, 2, 3 and 4 bytes', 'hé€😀'],
    ['ASCII', 'Hello, world!'],
    ['Cyrillic', 'Привіт'],
    ['Chinese', '你好世界'],
    ['One symbol, 2 code points: e and an accent', 'e\u0301'],
    ['One symbol, 7 code points: the flag of England', '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'],
    ['One symbol, 10 code points: a kiss with skin tones', '\u{1F469}\u{1F3FB}\u200D\u2764\uFE0F\u200D\u{1F48B}\u200D\u{1F468}\u{1F3FC}'],
]

/**
 * The state is the text itself, not its bytes: the bytes are a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * It opens on the first example, so the first thing a reader sees is all four
 * UTF-8 sequence lengths.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    name: 'text',
    label: 'Text',
    rows: 2,
    init: examples[0][1],
    examples,
})(text => [
    ['p', 'Code points, UTF-8 hex:'],
    ['pre', codePoints(text)],
])
