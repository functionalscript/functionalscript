/**
 * @import { Diagram } from './types.ts'
 */

import { anchor, codePointGuide, grammarDemo, railroadDemo, railroadSection, railroadSvg } from './module.f.mjs'
import { codePoints, tokens } from '../../../ebnf/railroad/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'
import { range, set } from '../../../ebnf/module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { runPure } from '../../../effects/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.js'

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

/**
 * Where the terminal labelled `label` is drawn: the `x` of its label's
 * centre.
 *
 * @type {(html: string, label: string) => number}
 */
const labelX = (html, label) => {
    const before = html.slice(0, html.indexOf(`data-railroad-label="terminal">${label}</text>`))
    const x = before.slice(before.lastIndexOf('<text x="') + '<text x="'.length)
    return Number(x.slice(0, x.indexOf('"')))
}

/**
 * Whether `first` is met before `second` along a track read left to right.
 *
 * @type {(d: Diagram, first: string, second: string) => boolean}
 */
const leftOf = (d, first, second) => {
    const html = svg(d)
    return labelX(html, first) < labelX(html, second)
}

/** @type {(title: string) => Diagram} */
const box = title => ['nonTerminal', title]

const digit = range('09')

/** A grammar over text with a source rule and a branch worth a diagram. */
const number = { one: digit, signed: [set('+-'), digit] }

const tokenEncoding = encoding(['=>', 'id'])

const id = tokenEncoding.encode('id')

/** A grammar over tokens with a branch worth a diagram. */
const lambda = { name: id, arrow: [id, tokenEncoding.encode('=>')] }

/** A token page's guide: its grey pills are any token of their kind. */
const tokenGuide = 'Follow a track from left to right; a pill is a token, a grey one in italics any token of its kind, and a box is another diagram — select it to go there.'

export const proof = {
    anchor: () => assertEq(anchor('value'), 'railroad-value'),
    // A section is the element a box links to: its id is the title's anchor.
    section: () => assertStructurallySame(railroadSection(['value', skip]),
        ['section', { id: 'railroad-value' }, ['h3', 'value'], railroadSvg(skip)]),
    demo: {
        // Its intro, then a section per diagram, in order.
        view: () => {
            const { init, view } = railroadDemo('intro')([['a', skip], ['b', t('b')]])
            assertStructurallySame(view(init),
                ['div', ['p', 'intro'], railroadSection(['a', skip]), railroadSection(['b', t('b')])])
        },
        // Nothing an event says changes the diagrams.
        update: () => {
            const { init, update } = railroadDemo('intro')([])
            assertEq(unwrap(assertNotNullish(runPure(update(init)({ kind: 'start' }))[0])), init)
        },
    },
    grammar: {
        // The intro is the description, then the code-point guide; the
        // grammar, a source rule and a branch are drawn in the order
        // selected, their symbols labelled as code points.
        codePoints: () => {
            const { init, view } = grammarDemo({
                grammar: number,
                alphabet: codePoints,
                description: 'The number grammar.',
                guide: codePointGuide,
                selections: [['number', number], ['digit', digit], ['signed', number, 'signed']],
            })
            assertStructurallySame(view(init), ['div',
                ['p', 'The number grammar. Follow a track from left to right; a pill is text the input holds, and a box is another diagram — select it to go there.'],
                railroadSection(['number', ['choice', [box('digit'), box('signed')]]]),
                railroadSection(['digit', t('0 … 9')]),
                railroadSection(['signed', ['sequence', [['choice', [t('+'), t('-')]], box('digit')]]]),
            ])
        },
        // A token page's guide explains its category pills, and its
        // alphabet labels the grammar and a branch alike: `id` as a
        // category, `=>` as the text it is.
        tokens: () => {
            const { init, view } = grammarDemo({
                grammar: lambda,
                alphabet: tokens(tokenEncoding, ['id']),
                description: 'The lambda grammar.',
                guide: tokenGuide,
                selections: [['lambda', lambda], ['arrow', lambda, 'arrow']],
            })
            assertStructurallySame(view(init), ['div',
                ['p', `The lambda grammar. ${tokenGuide}`],
                railroadSection(['lambda', ['choice', [['category', 'id'], box('arrow')]]]),
                railroadSection(['arrow', ['sequence', [['category', 'id'], t('=>')]]]),
            ])
        },
        throw: {
            // A rule the grammar never reaches has no name to draw.
            missingRule: () => grammarDemo({
                grammar: number, alphabet: codePoints, description: '', guide: codePointGuide,
                selections: [['letter', range('az')]],
            }),
            // A branch is a branch of a variant.
            notAVariant: () => grammarDemo({
                grammar: number, alphabet: codePoints, description: '', guide: codePointGuide,
                selections: [['digit', digit, 'one']],
            }),
            // A variant reaches no branch by a tag it lacks.
            noSuchBranch: () => grammarDemo({
                grammar: number, alphabet: codePoints, description: '', guide: codePointGuide,
                selections: [['zero', number, 'zero']],
            }),
        },
    },
    // A terminal in full: the start bar, its pill and label, the end bar.
    // A pill is at least 28 wide; its track runs 11 below its top.
    terminal: () => assertStructurallySame(railroadSvg(t('a')),
        ['div', { 'data-railroad': '' }, ['svg', { viewBox: '0 0 64 42', width: '64', height: '42' },
            ['path', { d: 'M10 13L10 29M10 21L18 21', 'data-railroad-line': '' }],
            ['rect', { x: '18', y: '10', width: '28', height: '22', rx: '11', 'data-railroad-box': 'terminal' }],
            ['text', { x: '32', y: '21', 'text-anchor': 'middle', 'data-railroad-label': 'terminal' }, 'a'],
            ['path', { d: 'M46 21L54 21M54 13L54 29', 'data-railroad-line': '' }],
        ]]),
    // A category is a pill as a terminal is, its box and label marked as a
    // category.
    category: () => assertStructurallySame(railroadSvg(['category', 'x']),
        ['div', { 'data-railroad': '' }, ['svg', { viewBox: '0 0 64 42', width: '64', height: '42' },
            ['path', { d: 'M10 13L10 29M10 21L18 21', 'data-railroad-line': '' }],
            ['rect', { x: '18', y: '10', width: '28', height: '22', rx: '11', 'data-railroad-box': 'category' }],
            ['text', { x: '32', y: '21', 'text-anchor': 'middle', 'data-railroad-label': 'category' }, 'x'],
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
        // The return runs right to left, so a separator's pieces are laid
        // out mirrored: following the track back, `,` is met before `ws`,
        // as the grammar spells `, ws`. On the forward track they are not.
        order: () => {
            const comma = /** @type {const} */ (['sequence', [t(','), t('ws')]])
            assert(leftOf(comma, ',', 'ws'))
            assert(leftOf(['loop', t('a'), comma], 'ws', ','))
        },
        // A loop on a return track turns back again: its own item runs
        // right to left and its return left to right, and its arrow points
        // down the left side, the way the return runs there. The outer
        // loop's arrow points up.
        nested: () => {
            const html = svg(['loop', t('a'), ['loop', ['sequence', [t('b'), t('c')]], ['sequence', [t('d'), t('e')]]]])
            assert(labelX(html, 'c') < labelX(html, 'b'), html)
            assert(labelX(html, 'd') < labelX(html, 'e'), html)
            assert(html.includes('M24 41L28 34L32 41'), html)
            assert(html.includes('M44 65L48 72L52 65'), html)
        },
    },
}
