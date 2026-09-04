/**
 * @import { Rule, Thunk } from '../types.ts'
 * @import { Rule as DataRule, RuleSet, RuleVisitor } from './types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { option, range, remove, repeat, repeatFrom0, set, times, unicodeMax } from '../module.f.mjs'
import { dataJs } from '../lib/datajs/module.f.mjs'
import { digit, json, string, uint, ws, wsSymbol } from '../lib/json/module.f.mjs'
import { emptyTagMap, matchRule, toData, validate } from './module.f.mjs'

const { keys } = Object
const { MAX_SAFE_INTEGER } = Number

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * Values as they arrive from outside the type system — a deserialized set, a
 * hand-written thunk — spelled as what they are and narrowed only at the
 * call that must refuse them.
 *
 * @type {unknown}
 */
const typo = ['typo']

/** @type {unknown} */
const notARule = true

/** @type {unknown} */
const repeatTrailing = ['repeat', 0, 1, 'digit', 'separator']

/** @type {unknown} */
const variantTrailing = ['variant', { zero: 'zero' }, 'extra']

/** @type {unknown} */
const variantNotAnObject = ['variant', ['zero']]

/** @type {unknown} */
const numericReference = ['sequence', 1]

/** @type {unknown} */
const numericItem = ['repeat', 0, 1, 1]

/** @type {(a: string) => readonly ['set', number, number]} */
const one = a => ['set', c(a), c(a) + 1]

/**
 * A hand-written grammar over every rule kind: an integer with an optional
 * minus, plus EOF and the top symbol as terminals of their own.
 *
 * @type {RuleSet}
 */
const int = {
    digit: ['set', c('0'), c('9') + 1],
    digits0: ['repeat', 0, Infinity, 'digit'],
    digits: ['sequence', 'digit', 'digits0'],
    zero: one('0'),
    uint: ['variant', { zero: 'zero', digits: 'digits' }],
    none: ['sequence'],
    minus: one('-'),
    optionalMinus: ['variant', { none: 'none', minus: 'minus' }],
    int: ['sequence', 'optionalMinus', 'uint'],
    eof: ['set', -1, 0],
    top: ['set', MAX_SAFE_INTEGER],
}

/** @type {RuleVisitor<string>} */
const show = {
    set: s => `set ${s.join(' ')}`,
    sequence: items => `sequence ${items.join(' ')}`,
    variant: branches => `variant ${keys(branches).join(' ')}`,
    repeat: (min, max, item) => `repeat ${min} ${max} ${item}`,
}

const showRule = matchRule(show)

/** @type {RuleVisitor<string | undefined>} */
const stringBranch = {
    set: () => undefined,
    sequence: () => undefined,
    variant: branches => branches.string,
    repeat: () => undefined,
}

/**
 * A grammar that is valid but for one rule, so a refusal names that rule and
 * nothing else.
 *
 * @type {(ruleSet: RuleSet) => void}
 */
const refuse = ruleSet => validate({ ...int, ...ruleSet }, 'int')

export const proof = {
    // Each handler receives the payload without its tag.
    matchRule: {
        kinds: () => {
            assertEq(showRule(int.digit), `set ${c('0')} ${c('9') + 1}`)
            assertEq(showRule(int.digits), 'sequence digit digits0')
            assertEq(showRule(int.none), 'sequence ')
            assertEq(showRule(int.uint), 'variant zero digits')
            assertEq(showRule(int.digits0), 'repeat 0 Infinity digit')
        },
        // The carrier is checked where the tag is read: a tag nothing
        // spells, a field past a fixed arity, or branches that are no
        // object, are refused rather than dispatched with a part dropped.
        throw: {
            unknownTag: () => showRule(/** @type {DataRule} */ (typo)),
            repeatTrailing: () => showRule(/** @type {DataRule} */ (repeatTrailing)),
            variantTrailing: () => showRule(/** @type {DataRule} */ (variantTrailing)),
            variantNotAnObject: () => showRule(/** @type {DataRule} */ (variantNotAnObject)),
        },
    },
    emptyTagMap: {
        // A set never matches empty; a repeat from zero always does, with no
        // tag; a sequence does iff every item does; a variant does iff a
        // branch does, and carries that branch's tag.
        kinds: () => {
            assertStructurallySame(emptyTagMap(int), {
                digit: undefined,
                digits0: true,
                digits: undefined,
                zero: undefined,
                uint: undefined,
                none: true,
                minus: undefined,
                optionalMinus: 'none',
                int: undefined,
                eof: undefined,
                top: undefined,
            })
        },
        // A repeat that must match at least once is nullable exactly when its
        // item is; a variant's tag is its last nullable branch's.
        item: () => {
            /** @type {RuleSet} */
            const ruleSet = {
                none: ['sequence'],
                x: one('x'),
                once: ['repeat', 1, 2, 'none'],
                onceX: ['repeat', 1, 2, 'x'],
                choice: ['variant', { a: 'none', b: 'x', c: 'none' }],
            }
            assertStructurallySame(emptyTagMap(ruleSet), {
                none: true,
                x: undefined,
                once: true,
                onceX: undefined,
                choice: 'c',
            })
        },
        // A rule may carry a name `{}` inherits — `constructor` — and reads
        // as its own entry, never as the inherited one.
        inherited: () => {
            /** @type {DataRule} */
            const self = ['sequence', 'constructor']
            /** @type {RuleSet} */
            const ruleSet = { constructor: self }
            assertStructurallySame(emptyTagMap(ruleSet), { constructor: undefined })
        },
        // Nullability propagates along a chain one rule per round, so a
        // rule three references away from the empty sequence needs three
        // rounds; a rule that reaches only itself never becomes nullable.
        rounds: () => {
            /** @type {RuleSet} */
            const ruleSet = {
                a: ['sequence', 'b'],
                b: ['sequence', 'c'],
                c: ['sequence'],
                self: ['sequence', 'self'],
            }
            assertStructurallySame(emptyTagMap(ruleSet), {
                a: true,
                b: true,
                c: true,
                self: undefined,
            })
        },
    },
    validate: {
        ok: () => {
            validate(int, 'int')
        },
        throw: {
            unknownEntry: () => validate(int, 'float'),
            unknownInSequence: () => refuse({ int: ['sequence', 'sign', 'uint'] }),
            unknownInVariant: () => refuse({ uint: ['variant', { zero: 'zero', digits: 'digit1' }] }),
            unknownInRepeat: () => refuse({ digits0: ['repeat', 0, Infinity, 'digi'] }),
            // A terminal is a canonical set: strictly increasing boundaries.
            setNotIncreasing: () => refuse({ digit: ['set', c('9'), c('0')] }),
            // The empty set is a rule that can never match.
            setEmpty: () => refuse({ digit: ['set'] }),
            // `b + 1` is exact for safe integers only, so a boundary above
            // them would name a different range than the one written.
            setUnsafe: () => refuse({ digit: ['set', 0, 2 ** 54] }),
            setBottomless: () => refuse({ digit: ['set', -Infinity, 5] }),
            // Below `0` there is only EOF, and EOF is a set of its own.
            setNegative: () => refuse({ digit: ['set', -2, 0] }),
            setMixesEof: () => refuse({ digit: ['set', -1, 5] }),
            minNegative: () => refuse({ digits0: ['repeat', -1, 2, 'digit'] }),
            minFractional: () => refuse({ digits0: ['repeat', 0.5, 2, 'digit'] }),
            maxFractional: () => refuse({ digits0: ['repeat', 0, 2.5, 'digit'] }),
            minAboveMax: () => refuse({ digits0: ['repeat', 3, 2, 'digit'] }),
            // A round that consumes nothing would repeat forever.
            nullableUnbounded: () => refuse({ digits0: ['repeat', 0, Infinity, 'none'] }),
            // Data is validated as data: a tag nothing spells is refused,
            // not certified, and so is a reference that is no string — a
            // number would reach the rule `'1'` through key coercion.
            unknownTag: () => validate({ entry: /** @type {DataRule} */ (typo) }, 'entry'),
            numericReference: () => validate({
                entry: /** @type {DataRule} */ (numericReference),
                1: one('a'),
            }, 'entry'),
            numericItem: () => validate({
                entry: /** @type {DataRule} */ (numericItem),
                1: one('a'),
            }, 'entry'),
        },
        // A nullable item under a bounded repeat is accepted: the bound is
        // the cardinality, and the item's own ambiguity is a backend's to
        // resolve as it resolves any variant's.
        nullableBounded: () => {
            validate({ ...int, digits0: ['repeat', 0, 3, 'none'] }, 'int')
            validate({ ...int, digits0: ['repeat', 2, 2, 'none'] }, 'int')
        },
    },
    toData: {
        // A number is one symbol; the entry of an anonymous rule is `''`.
        symbol: () => {
            const [ruleSet, entry, names] = toData(c('a'))
            assertEq(entry, '')
            assertStructurallySame(ruleSet, { '': one('a') })
            assertEq(names.get(c('a')), '')
        },
        eof: () => {
            const [ruleSet] = toData(-1)
            assertStructurallySame(ruleSet, { '': ['set', -1, 0] })
        },
        // The top ordinary symbol is the open tail: the boundary above it is
        // not a safe integer, so this is its only spelling.
        top: () => {
            const [ruleSet] = toData(MAX_SAFE_INTEGER)
            assertStructurallySame(ruleSet, { '': ['set', MAX_SAFE_INTEGER] })
        },
        string: {
            // One terminal per code point, named by position; a repeated
            // symbol is one rule, shared by value.
            codePoints: () => {
                const [ruleSet] = toData('aba')
                assertStructurallySame(ruleSet, {
                    '': ['sequence', '0', '1', '0'],
                    0: one('a'),
                    1: one('b'),
                })
            },
            empty: () => {
                const [ruleSet] = toData('')
                assertStructurallySame(ruleSet, { '': ['sequence'] })
            },
            // An astral code point is one symbol, not its two UTF-16 units.
            astral: () => {
                const [ruleSet] = toData(unicodeMax)
                assertStructurallySame(ruleSet, {
                    '': ['sequence', '0'],
                    0: ['set', 0x10FFFF, 0x110000],
                })
            },
        },
        // Elements are named by index under their sequence, branches by tag
        // under their variant.
        tuple: () => {
            const [ruleSet] = toData([c('a'), 'b'])
            assertStructurallySame(ruleSet, {
                '': ['sequence', '0', '1'],
                0: one('a'),
                1: ['sequence', '1.0'],
                '1.0': one('b'),
            })
        },
        variant: () => {
            const [ruleSet] = toData({ a: c('a'), b: 'b' })
            assertStructurallySame(ruleSet, {
                '': ['variant', { a: 'a', b: 'b' }],
                a: one('a'),
                b: ['sequence', 'b.0'],
                'b.0': one('b'),
            })
        },
        // A set thunk is the front end's tuple with the thunk gone, and a
        // repeat thunk names its item under its own name.
        set: () => {
            const [ruleSet] = toData(remove(range(' ~'), set('"\\')))
            assertStructurallySame(ruleSet, {
                '': ['set', c(' '), c('"'), c('"') + 1, c('\\'), c('\\') + 1, c('~') + 1],
            })
        },
        repeat: () => {
            const [ruleSet] = toData(repeat(2, 5)(range('09')))
            assertStructurallySame(ruleSet, {
                '': ['repeat', 2, 5, 'item'],
                item: ['set', c('0'), c('9') + 1],
            })
        },
        // A thunk with a name is named by it, and a `const` thunk is the rule
        // its body spells, under that name, with no rule for the indirection.
        constThunk: () => {
            const digits = () => /** @type {const} */ (['const', [range('09'), 'x']])
            const [ruleSet, entry] = toData(digits)
            assertEq(entry, 'digits')
            assertStructurallySame(ruleSet, {
                digits: ['sequence', 'digits.0', 'digits.1'],
                'digits.0': ['set', c('0'), c('9') + 1],
                'digits.1': ['sequence', 'digits.1.0'],
                'digits.1.0': one('x'),
            })
        },
        // A rule that names itself is registered before its body is read, so
        // the body finds it; a repeat whose item reaches the repeat is the
        // grammar the classical fold could not say.
        recursive: () => {
            /** @type {Thunk} */
            const parens = () => ['const', { pair: ['(', parens, ')'], none: [] }]
            const [ruleSet, entry] = toData(parens)
            assertEq(entry, 'parens')
            assertStructurallySame(ruleSet, {
                parens: ['variant', { pair: 'parens.pair', none: 'parens.none' }],
                'parens.pair': ['sequence', 'parens.pair.0', 'parens', 'parens.pair.2'],
                'parens.pair.0': ['sequence', 'parens.pair.0.0'],
                'parens.pair.0.0': one('('),
                'parens.pair.2': ['sequence', 'parens.pair.2.0'],
                'parens.pair.2.0': one(')'),
                'parens.none': ['sequence'],
            })
        },
        recursiveRepeat: () => {
            /** @type {Thunk} */
            const nest = () => ['repeat', 0, Infinity, ['(', nest, ')']]
            const [ruleSet] = toData(nest)
            assertStructurallySame(ruleSet, {
                nest: ['repeat', 0, Infinity, 'nest.item'],
                'nest.item': ['sequence', 'nest.item.0', 'nest', 'nest.item.2'],
                'nest.item.0': ['sequence', 'nest.item.0.0'],
                'nest.item.0.0': one('('),
                'nest.item.2': ['sequence', 'nest.item.2.0'],
                'nest.item.2.0': one(')'),
            })
        },
        // Sharing is by identity: a rule held twice is one named rule, and
        // the map names it by the rule the author holds.
        shared: () => {
            const digit = range('09')
            const [ruleSet, , names] = toData([digit, digit])
            assertStructurallySame(ruleSet, {
                '': ['sequence', '0', '0'],
                0: ['set', c('0'), c('9') + 1],
            })
            assertEq(names.get(digit), '0')
            assertEq(names.size, 2)
        },
        // A thunk may be named as `{}`'s prototype names things, and the
        // rule set and the identity map both read it as their own entry.
        inheritedName: () => {
            const constructor = () => /** @type {const} */ (['const', 'x'])
            const [ruleSet, entry, names] = toData(constructor)
            assertEq(entry, 'constructor')
            assertEq(names.get(constructor), 'constructor')
            assertStructurallySame(ruleSet, {
                constructor: ['sequence', 'constructor.0'],
                'constructor.0': one('x'),
            })
        },
        // Two thunks with one name: the second gets a counter.
        sameName: () => {
            const first = { a: () => /** @type {const} */ (['const', 'x']) }
            const second = { a: () => /** @type {const} */ (['const', 'y']) }
            const [ruleSet] = toData([first.a, second.a])
            assertStructurallySame(ruleSet, {
                '': ['sequence', 'a', 'a1'],
                a: ['sequence', 'a.0'],
                'a.0': one('x'),
                a1: ['sequence', 'a1.0'],
                'a1.0': one('y'),
            })
        },
        // A hand-written set is clipped to the domain: a generic
        // complement's `-Infinity` and anything below `0` are dropped.
        clipped: () => {
            /** @type {Thunk} */
            const below = () => ['set', -Infinity, 5]
            const [ruleSet] = toData(below)
            assertStructurallySame(ruleSet, { below: ['set', 0, 5] })
        },
        throw: {
            // A symbol is a non-negative safe integer, or EOF.
            symbolNegative: () => toData(-2),
            symbolFractional: () => toData(1.5),
            symbolUnsafe: () => toData(2 ** 53),
            malformedUtf16: () => toData('\uD800'),
            // A hand-written set that is not canonical is refused before the
            // algebra reads it; one that clips to nothing is refused after.
            setNotCanonical: () => toData(() => ['set', 5, 3]),
            setClippedToNothing: () => toData(() => ['set', -1, 0]),
            setEmpty: () => toData(set('')),
            boundsReversed: () => toData(repeat(3, 2)('x')),
            nullableUnbounded: () => toData(repeatFrom0(option('x'))),
            // A hand-written thunk with a tag nothing spells, and a value
            // that is no rule at all, are refused rather than lowered.
            unknownTag: () => toData(() => /** @type {readonly ['const', string]} */ (typo)),
            notARule: () => toData(/** @type {Rule} */ (notARule)),
        },
        // The grammars of `../lib` lower and validate whole. What the contract
        // fixes is the entry and the identity map, never a generated name, so
        // the JSON rules are read through the map: the rule an author holds
        // is the rule a backend finds, with the same name at every reference.
        json: () => {
            const [ruleSet, entry, names] = toData(json)
            assertEq(entry, '')
            /** @type {(rule: Rule) => string} */
            const nameOf = rule => assertNotNullish(names.get(rule))
            assertStructurallySame(ruleSet[entry], ['sequence', nameOf(ws), 'value', nameOf(ws)])
            assertStructurallySame(ruleSet[nameOf(ws)], ['repeat', 0, Infinity, nameOf(wsSymbol)])
            assertStructurallySame(ruleSet[nameOf(wsSymbol)], ['set', 9, 11, 13, 14, 32, 33])
            assertStructurallySame(ruleSet[nameOf(digit)], ['set', c('0'), c('9') + 1])
            assertStructurallySame(ruleSet[nameOf(uint)], ['variant', {
                0: nameOf('0'),
                onenine: nameOf(uint.onenine),
            }])
            // The string rule is held by the `string` alternative and by an
            // object's property, so both name the one rule.
            assertEq(matchRule(stringBranch)(ruleSet.value), nameOf(string))
            assertEq(keys(ruleSet).length, 81)
        },
        dataJs: () => {
            const [ruleSet, entry] = toData(dataJs)
            assertEq(entry, '')
            assert(keys(ruleSet).length > 40)
        },
        // The classical option is a bounded repeat, and `times` an exact one.
        bounds: () => {
            const [ruleSet] = toData([option('a'), times(4)('b')])
            assertStructurallySame(ruleSet, {
                '': ['sequence', '0', '1'],
                0: ['repeat', 0, 1, '0.item'],
                '0.item': ['sequence', '0.item.0'],
                '0.item.0': one('a'),
                1: ['repeat', 4, 4, '1.item'],
                '1.item': ['sequence', '1.item.0'],
                '1.item.0': one('b'),
            })
        },
    },
}
