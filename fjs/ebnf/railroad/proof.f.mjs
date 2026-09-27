/**
 * @import { Const, DataRule, Rule } from '../types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { Diagram } from '../../website/demo/railroad/types.ts'
 */

import { branch, toDiagrams } from './module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { eof, join, option, range, rangeEncode, repeat, repeatFrom, repeatFrom0, repeatFrom1, set, times } from '../module.f.mjs'
import { assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(text: string) => Diagram} */
const t = text => ['terminal', text]

/** @type {Diagram} */
const skip = ['skip']

/** @type {(d: Diagram, separator?: Diagram) => Diagram} */
const loop = (d, separator = skip) => ['loop', d, separator]

/**
 * `fr`'s diagram, with its entry the one rule titled: everything else it
 * reaches is drawn in place.
 *
 * @type {(fr: Rule) => Diagram}
 */
const diagram = fr => {
    const [ruleSet, entry] = toData(fr)
    const [[, d]] = toDiagrams(ruleSet)([['root', entry]])
    return d
}

/** @type {(fr: Rule, expected: Diagram) => () => void} */
const draws = (fr, expected) => () => assertStructurallySame(diagram(fr), expected)

/**
 * `e = '(' e? ')'`: a rule that reaches itself.
 *
 * @type {Const<DataRule>}
 */
const nested = () => ['const', ['(', option(nested), ')']]

/**
 * `l = 'a' l?`: a rule that reaches itself, reached from an entry that
 * does not.
 *
 * @type {Const<DataRule>}
 */
const tail = () => ['const', ['a', option(tail)]]

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
            assertStructurallySame(toDiagrams(ruleSet)([['a', 'a']]), [['a', t('A …')]])
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
        // A set of more than one run is not the literal of its first run:
        // `Ee` then `x` is either `Ex` or `ex`.
        multiRun: draws([set('Ee'), set('x')], ['sequence', [['choice', [t('E'), t('e')]], t('x')]]),
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
        recursive: draws(nested, ['sequence', [t('('), ['choice', [skip, ['nonTerminal', 'root']]], t(')')]]),
        // Each titled rule gets its diagram, in the order given, and every
        // other diagram reaches it as a box.
        several: () => {
            const [ruleSet, entry, names] = toData([digit, digit])
            assertStructurallySame(
                toDiagrams(ruleSet)([['pair', entry], ['digit', assertNotNullish(names.get(digit))]]),
                [
                    ['pair', ['sequence', [['nonTerminal', 'digit'], ['nonTerminal', 'digit']]]],
                    ['digit', t('0 … 9')],
                ])
        },
    },
    throw: {
        // A rule that reaches itself through untitled rules only has no box
        // to stop at.
        untitledRecursion: () => diagram(['b', tail]),
        // A box for a rule titled twice would have two diagrams to link to.
        titledTwice: () => {
            const [ruleSet, entry] = toData('a')
            toDiagrams(ruleSet)([['a', entry], ['b', entry]])
        },
        // A token symbol is no code point, and has no label here yet.
        tokenSymbol: () => {
            /** @type {RuleSet} */
            const ruleSet = { a: ['set', 0x110000, 0x110001] }
            toDiagrams(ruleSet)([['a', 'a']])
        },
        // Two rules under one title would be two diagrams behind one link.
        titleTwice: () => {
            const [ruleSet, , names] = toData(['a', 'b'])
            toDiagrams(ruleSet)([['same', assertNotNullish(names.get('a'))], ['same', assertNotNullish(names.get('b'))]])
        },
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
    branch: () => {
        const [ruleSet, entry] = toData({ a: 'a', b: digit })
        const [digitSet, digitEntry] = toData(digit)
        assertStructurallySame(ruleSet[branch(ruleSet)(entry, 'b')], digitSet[digitEntry])
    },
}
