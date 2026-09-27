/**
 * @import { Const, DataRule, Rule } from '../types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { Diagram } from '../../website/demo/railroad/types.ts'
 */

import { branch, toDiagram } from './module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { eof, join, option, range, rangeEncode, repeat, repeatFrom, repeatFrom0, repeatFrom1, set, times } from '../module.f.mjs'
import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(text: string) => Diagram} */
const t = text => ['terminal', text]

/** @type {Diagram} */
const skip = ['skip']

/** @type {(d: Diagram, separator?: Diagram) => Diagram} */
const loop = (d, separator = skip) => ['loop', d, separator]

/**
 * `fr`'s diagram, with no rule titled: everything it reaches is drawn in
 * place.
 *
 * @type {(fr: Rule) => Diagram}
 */
const untitled = fr => {
    const [ruleSet, entry] = toData(fr)
    return toDiagram(ruleSet)(new Map())(entry)
}

/** @type {(fr: Rule, expected: Diagram) => () => void} */
const draws = (fr, expected) => () => assertStructurallySame(untitled(fr), expected)

/**
 * `e = '(' e? ')'`: a rule that reaches itself, so drawing it in full needs
 * a title for the box it reaches itself through.
 *
 * @type {Const<DataRule>}
 */
const nested = () => ['const', ['(', option(nested), ')']]

const digit = range('09')

export const proof = {
    set: {
        // A string lowered to single printable symbols is the one text.
        literal: draws('true', t('true')),
        eof: draws(eof, t('EOF')),
        range: draws(range('09'), t('0 … 9')),
        // Short runs split into their symbols, and the whitespace ones are
        // named: `\t`, `\n`, `\r`, `space`.
        short: draws(set(' \t\n\r'), ['choice', [t('\\t'), t('\\n'), t('\\r'), t('space')]]),
        // Control and non-ASCII symbols are code points.
        codePoints: draws(rangeEncode(0, 0x10), t('U+0000 … U+0010')),
        nonAscii: draws(set('é'), t('U+00E9')),
        // A set whose last boundary is unpaired runs to the top of the
        // alphabet, and says so.
        openTail: () => {
            /** @type {RuleSet} */
            const ruleSet = { a: ['set', 0x41] }
            assertStructurallySame(toDiagram(ruleSet)(new Map())('a'), t('A …'))
        },
    },
    sequence: {
        empty: draws([], skip),
        // A space is not printable, so the text is not one terminal.
        mixed: draws(' a', ['sequence', [t('space'), t('a')]]),
        // A set that is more than one symbol is not a literal either.
        notLiteral: draws([range('09'), 'b'], ['sequence', [t('0 … 9'), t('b')]]),
        // `join`: an item, then any number of `separator, item`.
        join: draws(join(',')(range('az')), ['choice', [skip, loop(t('a … z'), t(','))]]),
        // An item, then any number of itself.
        // The same rule both times: equal sets written twice are two rules.
        oneOrMore: draws([digit, repeatFrom0(digit)], loop(t('0 … 9'))),
        // A repeat after an item that is neither of those shapes.
        otherItem: draws([range('09'), repeatFrom0(range('az'))],
            ['sequence', [t('0 … 9'), ['choice', [skip, loop(t('a … z'))]]]]),
        otherSeparator: draws([range('09'), repeatFrom0([',', range('az')])],
            ['sequence', [t('0 … 9'), ['choice', [skip, loop(['sequence', [t(','), t('a … z')]])]]]]),
        bounded: draws([range('09'), option(range('09'))],
            ['sequence', [t('0 … 9'), ['choice', [skip, t('0 … 9')]]]]),
    },
    // A variant is a choice, and a branch that is itself a choice adds its
    // rows to the column rather than a column of its own.
    variant: draws({ s: set(' \t'), x: 'x' }, ['choice', [t('\\t'), t('space'), t('x')]]),
    repeat: {
        option: draws(option('a'), ['choice', [skip, t('a')]]),
        zeroOrMore: draws(repeatFrom0('a'), ['choice', [skip, loop(t('a'))]]),
        oneOrMore: draws(repeatFrom1('a'), loop(t('a'))),
        twoOrMore: draws(repeatFrom(2)('a'), ['sequence', [t('a'), loop(t('a'))]]),
        times: draws(times(2)('a'), ['sequence', [t('a'), t('a')]]),
        bounded: draws(repeat(1, 3)('a'), ['sequence', [t('a'), ['choice', [skip, t('a')]], ['choice', [skip, t('a')]]]]),
    },
    titles: {
        // A titled rule is a box wherever it is reached — the rule being
        // drawn included, so reaching itself is a box, not a loop forever.
        recursive: () => {
            const [ruleSet, entry] = toData(nested)
            assertStructurallySame(
                toDiagram(ruleSet)(new Map([[entry, 'e']]))(entry),
                ['sequence', [t('('), ['choice', [skip, ['nonTerminal', 'e']]], t(')')]])
        },
    },
    branch: () => {
        const [ruleSet, entry] = toData({ a: 'a', b: range('09') })
        assertStructurallySame(untitled(range('09')), toDiagram(ruleSet)(new Map())(branch(ruleSet)(entry, 'b')))
    },
    throw: {
        // With no title, a rule that reaches itself has no box to stop at.
        untitledRecursion: () => untitled(nested),
        notAVariant: () => {
            const [ruleSet, entry] = toData('a')
            branch(ruleSet)(entry, 'a')
        },
        noSuchBranch: () => {
            const [ruleSet, entry] = toData({ a: 'a' })
            branch(ruleSet)(entry, 'b')
        },
    },
    // The rule a branch names is the rule a variant reaches.
    branchName: () => {
        const [ruleSet, entry] = toData({ a: 'a' })
        assertEq(ruleSet[branch(ruleSet)(entry, 'a')][0], 'sequence')
    },
}
