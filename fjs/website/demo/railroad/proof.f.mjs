/**
 * @import { Diagram } from './types.ts'
 */

import { anchor, railroadSvg } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(text: string) => Diagram} */
const t = text => ['terminal', text]

/** @type {Diagram} */
const skip = ['skip']

/** @type {(d: Diagram) => string} */
const svg = d => htmlToString(railroadSvg(d))

/**
 * `d` draws `width` by `height`: its own size, plus the margin and the
 * bars at either end.
 *
 * @type {(d: Diagram, width: number, height: number) => () => void}
 */
const size = (d, width, height) => () => assert(svg(d).includes(`viewBox="0 0 ${width} ${height}"`), [svg(d), width, height])

export const proof = {
    anchor: () => assertEq(anchor('value'), 'railroad-value'),
    // A terminal in full: the start bar, its pill and label, the end bar.
    // A pill is at least 28 wide; its track runs 11 below its top.
    terminal: () => assertStructurallySame(railroadSvg(t('a')),
        ['div', { 'data-railroad': '' }, ['svg', { viewBox: '0 0 64 42', width: '64', height: '42' },
            ['path', { d: 'M10 13L10 29M10 21L18 21', 'data-railroad-line': '' }],
            ['rect', { x: '18', y: '10', width: '28', height: '22', rx: '11', 'data-railroad-box': 'terminal' }],
            ['text', { x: '32', y: '21', 'text-anchor': 'middle', 'data-railroad-label': 'terminal' }, 'a'],
            ['path', { d: 'M46 21L54 21M54 13L54 29', 'data-railroad-line': '' }],
        ]]),
    // A box links to its diagram, by the id `anchor` gives it.
    nonTerminal: () => assert(svg(['nonTerminal', 'value']).includes('<a href="#railroad-value">')),
    // A long label widens its box: 8 per character, and 16 to spare.
    wide: size(t('abcdefghij'), 18 + 96 + 18, 42),
    skip: size(skip, 36, 36),
    sequence: {
        empty: size(['sequence', []], 36, 36),
        // Two pills and the gap between them.
        two: size(['sequence', [t('a'), t('b')]], 18 + 28 + 12 + 28 + 18, 42),
    },
    choice: {
        // Past a pill, it on a branch below: the track runs straight
        // through, and the branch drops 21, to clear the pill.
        optional: size(['choice', [skip, t('a')]], 18 + 28 + 40 + 18, 18 + 21 + 11 + 10),
        // Rows of pills, each dropping 32 below the one before.
        rows: size(['choice', [t('a'), t('b'), t('c')]], 18 + 28 + 40 + 18, 10 + 11 + 64 + 11 + 10),
    },
    loop: {
        // Nothing between the copies: the return track drops 21.
        plain: size(['loop', t('a'), skip], 18 + 28 + 40 + 18, 10 + 11 + 21 + 10),
        // A separator on the way back: it drops 32, to clear both pills.
        separator: size(['loop', t('a'), t(',')], 18 + 28 + 40 + 18, 10 + 11 + 32 + 11 + 10),
    },
}
