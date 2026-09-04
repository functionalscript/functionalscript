/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Ast } from '../ast/types.ts'
 * @import { Rule } from '../types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { Parser } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { eof, join, option, range, repeat, repeatFrom0, repeatFrom1, times } from '../module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { dataJs } from '../lib/datajs/module.f.mjs'
import { json } from '../lib/json/module.f.mjs'
import { rewrite } from '../map/module.f.mjs'
import { firstMap, parser, parserRuleSet } from './module.f.mjs'

const { keys } = Object

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The input a text parser is given: the code points of a string.
 *
 * @type {(s: string) => readonly number[]}
 */
const cps = s => toArray(stringToCodePointList(s))

/** @type {(a: string) => readonly ['set', number, number]} */
const one = a => ['set', c(a), c(a) + 1]

/**
 * A hand-written grammar over every rule kind: an integer with an optional
 * minus and no leading zero, then the end of input.
 *
 * @type {RuleSet}
 */
const int = {
    digit: ['set', c('0'), c('9') + 1],
    digits0: ['repeat', 0, Infinity, 'digit'],
    onenine: ['set', c('1'), c('9') + 1],
    positive: ['sequence', 'onenine', 'digits0'],
    zero: one('0'),
    uint: ['variant', { zero: 'zero', positive: 'positive' }],
    none: ['sequence'],
    minus: one('-'),
    sign: ['variant', { none: 'none', minus: 'minus' }],
    int: ['sequence', 'sign', 'uint'],
    document: ['sequence', 'int', 'eof'],
    eof: ['set', -1, 0],
}

const digits = /**@type {const}*/([c('0'), c('9') + 1])

const sign = /**@type {const}*/([c('-'), c('-') + 1])

// The 207 example grammar in EBNF, as `../map`'s proof spells it: a list of
// integers, `[-12,3]`, and the map that rewrites its tree to the integers.

const digit = range('09')

const digits1 = repeatFrom1(digit)

const optionMinus = option('-')

const integer = /**@type {const}*/([optionMinus, digits1])

const list = /**@type {const}*/(['[', join(',')(integer), ']'])

const integers = rewrite([
    [digit, /** @type {(d: number) => number} */ (d => d - c('0'))],
    [digits1, /** @type {(ds: readonly [number, ...(readonly number[])]) => number} */
        (ds => ds.reduce((n, d) => n * 10 + d, 0))],
    [optionMinus, /** @type {(s: readonly [] | readonly [readonly number[]]) => 1 | -1} */
        (s => s.length === 0 ? 1 : -1)],
    [integer, /** @type {(v: readonly [1 | -1, number]) => number} */ (([s, n]) => s * n)],
    [list, /** @type {(v: readonly [readonly number[], readonly [] | readonly [readonly [number, readonly (readonly [readonly number[], number])[]]], readonly number[]]) => readonly number[]} */
        (([, o]) => o.length === 0 ? [] : [o[0][0], ...o[0][1].map(([, i]) => i)])],
])

/** A JSON document is the grammar's `json` rule, then the end of input. */
const document = /**@type {const}*/([json, eof])

const parseJson = parser(json)

const parseDocument = parser(document)

const parseDataJs = parser(dataJs)

// A JSON number is `[optionNeg, uint, ...optionFloatSuffix]`: no minus, the
// `onenine` branch of `uint` with no further digits, no fraction, no
// exponent.
const one1 = /**@type {const}*/(['number', [[], ['onenine', [c('1'), []]], [], []]])

// `[1]`: the whitespace runs are empty; the array is its bracket, whitespace,
// one item — the option `join` builds holds the item, its whitespace, and no
// separator-item pairs — and its bracket.
const array1 = /**@type {const}*/(['array', [[c('[')], [], [[[one1, []], []]], [c(']')]]])

/** @type {Ast<typeof json>} */
const json1 = [[], array1, []]

export const proof = {
    firstMap: {
        // A set begins with its symbols; a sequence with its items' up to
        // and including the first that cannot match empty, so `int`'s holds
        // the sign's and the digits' where `positive`'s holds only the
        // leading digit's; a variant with its branches'; a repetition with
        // its item's; and EOF with `-1`.
        kinds: () => {
            assertStructurallySame(firstMap(int), {
                digit: digits,
                digits0: digits,
                onenine: [c('1'), c('9') + 1],
                positive: [c('1'), c('9') + 1],
                zero: [c('0'), c('0') + 1],
                uint: digits,
                none: [],
                minus: sign,
                sign,
                int: [...sign, ...digits],
                document: [...sign, ...digits],
                eof: [-1, 0],
            })
        },
        // Every rule the lowering emits gets a first set, and the entry's is
        // what a document may begin with: whitespace or a value.
        json: () => {
            const [ruleSet, entry] = toData(json)
            const first = firstMap(ruleSet)
            assertStructurallySame(keys(first).toSorted(), keys(ruleSet).toSorted())
            assertStructurallySame(first[entry], [
                9, 11, 13, 14, 32, 33, 34, 35, 45, 46, 48, 58, 91, 92,
                c('f'), c('f') + 1, c('n'), c('n') + 1, c('t'), c('t') + 1, c('{'), c('{') + 1,
            ])
        },
        // A repetition of at most zero rounds never enters its item, so its
        // first set is empty: a variant of it beside its item is not a
        // conflict, and the lookahead selects the item's branch while a
        // miss selects the empty one.
        zeroRounds: () => {
            assertStructurallySame(firstMap({ z: ['repeat', 0, 0, 'x'], x: one('x') }), { z: [], x: [c('x'), c('x') + 1] })
            const p = parser({ empty: times(0)('x'), x: 'x' })
            assertStructurallySame(p(cps('x')), ['ok', [['x', cps('x')], 1]])
            assertStructurallySame(p([]), ['ok', [['empty', []], 0]])
        },
        // A rule that may begin with the end of input has `-1` in its first
        // set beside its symbols.
        eof: () => {
            const [ruleSet, entry] = toData([option('x'), eof])
            assertStructurallySame(firstMap(ruleSet)[entry], [-1, 0, c('x'), c('x') + 1])
        },
        throw: {
            // A rule that reaches itself before consuming a symbol: directly,
            // through a prefix that matches empty, through a variant's
            // branch, or as the item of its own repetition — a bounded one,
            // which `validate` admits and no lookahead decides.
            leftRecursion: () => firstMap({ a: ['sequence', 'a', 'x'], x: one('x') }),
            leftRecursionNullablePrefix: () => firstMap({
                a: ['sequence', 'none', 'a'],
                none: ['sequence'],
            }),
            leftRecursionVariant: () => firstMap({
                a: ['variant', { b: 'b' }],
                b: ['sequence', 'a', 'x'],
                x: one('x'),
            }),
            leftRecursionRepeat: () => firstMap({ r: ['repeat', 0, 2, 'r'] }),
            // Two branches beginning with a symbol in common: the classical
            // `uint` — `0`, or a digit followed by digits — where `0` is a
            // digit; a shared first symbol reached through an optional
            // prefix; and EOF, a first symbol like any other.
            firstFirstConflict: () => firstMap({
                ...int,
                digits: ['sequence', 'digit', 'digits0'],
                uint: ['variant', { zero: 'zero', digits: 'digits' }],
            }),
            firstFirstConflictNullablePrefix: () => firstMap(toData({
                a: [option('x'), 'y'],
                b: 'x',
            })[0]),
            firstFirstConflictEof: () => firstMap(toData({ a: eof, b: [option('x'), eof] })[0]),
        },
    },
    // A tree per form, as `Ast<R>` gives it.
    parser: {
        // A set's node is the symbol; a symbol outside the set fails at its
        // index, and so does the end of input, at the length.
        set: () => {
            const p = parser(digit)
            assertStructurallySame(p([c('5')]), ['ok', [c('5'), 1]])
            assertStructurallySame(p([c('a')]), ['error', 0])
            assertStructurallySame(p([]), ['error', 0])
        },
        // The end of input is synthesized once, after the last symbol, and
        // its node is empty. It is not available before the end, and after
        // it was consumed there is no symbol at all: a second EOF fails, a
        // variant has nothing to select on, and an optional rule matches
        // zero rounds. Consuming it does not move the public index.
        eof: () => {
            assertStructurallySame(parser(eof)([]), ['ok', [[], 0]])
            assertStructurallySame(parser(eof)([c('A')]), ['error', 0])
            assertStructurallySame(parser([range('AA'), eof])([c('A')]), ['ok', [[c('A'), []], 1]])
            assertStructurallySame(parser([eof, eof])([]), ['error', 0])
            assertStructurallySame(parser([eof, { a: 'A' }])([]), ['error', 0])
            assertStructurallySame(parser([eof, option('A')])([]), ['ok', [[[], []], 0]])
        },
        // A string is a sequence of its symbols; the empty one is the empty
        // sequence, matched without input.
        sequence: () => {
            assertStructurallySame(parser('ab')(cps('ab')), ['ok', [cps('ab'), 2]])
            assertStructurallySame(parser('ab')(cps('ac')), ['error', 1])
            assertStructurallySame(parser('')([]), ['ok', [[], 0]])
        },
        // A variant's node is the branch taken, tagged: the branch the
        // lookahead selects, else the last that matches empty, else none —
        // and a key is its runtime string.
        variant: () => {
            const p = parser({ a: 'x', b: 'y', n: option('z') })
            assertStructurallySame(p(cps('y')), ['ok', [['b', cps('y')], 1]])
            assertStructurallySame(p(cps('z')), ['ok', [['n', [cps('z')]], 1]])
            assertStructurallySame(p(cps('q')), ['ok', [['n', []], 0]])
            assertStructurallySame(p([]), ['ok', [['n', []], 0]])
            assertStructurallySame(parser({ a: 'x', b: 'y' })(cps('q')), ['error', 0])
            assertStructurallySame(parser({ 0: 'x' })(cps('x')), ['ok', [['0', cps('x')], 1]])
            assertStructurallySame(parser({ a: '', b: '' })([]), ['ok', [['b', []], 0]])
        },
        // A repetition is one flat node whatever its bounds. A round is
        // forced below `min`, so too few fail where the missing round would
        // have begun; optional up to `max`, starting exactly while the
        // lookahead is in the item's first set; and none past `max`.
        repeat: () => {
            const two = parser(times(2)(digit))
            assertStructurallySame(two(cps('12')), ['ok', [[c('1'), c('2')], 2]])
            assertStructurallySame(two(cps('123')), ['ok', [[c('1'), c('2')], 2]])
            assertStructurallySame(two(cps('1')), ['error', 1])
            assertStructurallySame(two(cps('1x')), ['error', 1])
            const oneOrTwo = parser(repeat(1, 2)(digit))
            assertStructurallySame(oneOrTwo(cps('1x')), ['ok', [[c('1')], 1]])
            assertStructurallySame(oneOrTwo(cps('12x')), ['ok', [[c('1'), c('2')], 2]])
            const any = parser(repeatFrom0(digit))
            assertStructurallySame(any([]), ['ok', [[], 0]])
            assertStructurallySame(any(cps('123x')), ['ok', [[c('1'), c('2'), c('3')], 3]])
            assertStructurallySame(parser(repeatFrom1(digit))([]), ['error', 0])
        },
        // The rule's literal type survives the call — `R` is a `const` type
        // parameter — so the parser is typed by the tree the rule builds.
        // The assertion is what makes the modifier load-bearing: dropping it
        // would widen every inline rule silently and `tsc` would still pass.
        constParameter: () => {
            const p = parser({ a: 'x', b: ['y', 42] })
            /** @typedef {Assert<Equal<typeof p, Parser<readonly ['a', readonly number[]] | readonly ['b', readonly [readonly number[], 42]]>>>} _ConstParameter */
            assertStructurallySame(p(cps('y*')), ['ok', [['b', [cps('y'), 42]], 2]])
        },
        // A nullable item under a bounded repeat, as `../data` promises: a
        // forced round matches empty, so `times(3)('')` matches empty three
        // times, and an optional round never starts on it, so `option('')`
        // matches it zero times.
        repeatNullable: () => {
            assertStructurallySame(parser(times(3)(''))([]), ['ok', [[[], [], []], 0]])
            assertStructurallySame(parser(option(''))([]), ['ok', [[], 0]])
        },
        // The tree is `Ast<R>`, so the map's rewrite takes it as it is: the
        // example grammar parsed and rewritten is the integers.
        integers: () => {
            /** @type {Parser<Ast<typeof list>>} */
            const p = parser(list)
            const toIntegers = integers(list)
            const [ast] = unwrap(p(cps('[-12,3]')))
            assertStructurallySame(toIntegers(ast), [-12, 3])
            const [empty] = unwrap(p(cps('[]')))
            assertStructurallySame(toIntegers(empty), [])
            assertStructurallySame(p(cps('[1,]')), ['error', 3])
        },
    },
    // The `lib` grammars are LL(1), and the parser built for them stops
    // where the grammar does.
    json: {
        // A small document, pinned node by node.
        array: () => {
            assertStructurallySame(parseJson(cps('[1]')), ['ok', [json1, 3]])
        },
        // A larger one: the rewrite with nothing mapped is the identity, and
        // it refuses a tree that is not the rule's, so its acceptance is a
        // second check that every node is the one `Ast<R>` gives.
        identity: () => {
            const text = ' [1.5e-3, {"a\\u00e9\\n": null, "": [true, false]}, "x"] '
            const [ast, end] = unwrap(parseJson(cps(text)))
            assertEq(end, text.length)
            assertStructurallySame(rewrite([])(json)(ast), ast)
        },
        // Without EOF a grammar stops where its rule does; with it the
        // trailing symbol is refused.
        trailing: () => {
            assertStructurallySame(parseJson(cps('[1]x')), ['ok', [json1, 3]])
            assertStructurallySame(parseDocument(cps('[1]x')), ['error', 3])
            assertStructurallySame(parseDocument(cps('[1]')), ['ok', [[json1, []], 3]])
        },
        // A failure is reported at the symbol it happened at; running out of
        // input is a failure at the length.
        failure: () => {
            assertStructurallySame(parseJson(cps('[1,')), ['error', 3])
            assertStructurallySame(parseJson(cps('[1 x]')), ['error', 3])
            assertStructurallySame(parseJson(cps('tru')), ['error', 3])
            assertStructurallySame(parseJson(cps('')), ['error', 0])
        },
        // Nesting depth grows with the input, and the machine's stack grows
        // on the heap with it: 5000 levels of brackets, and a repetition
        // 10000 rounds long, both match.
        deep: () => {
            const n = 5000
            assertEq(unwrap(parseDocument(cps('['.repeat(n) + ']'.repeat(n))))[1], 2 * n)
            assertEq(unwrap(parseDocument(cps(`${' '.repeat(10000)}1`)))[1], 10001)
        },
    },
    dataJs: () => {
        const text = 'const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];'
        assertEq(unwrap(parseDataJs(cps(text)))[1], text.length)
        assertEq(unwrap(parseDataJs(cps('export default [4,{},{}];')))[1], 25)
        assertStructurallySame(parseDataJs(cps('export default;')), ['error', 14])
    },
    // A hand-written set is matched at its entry: the tree of `-12` is the
    // sign's branch, the number's branch, and the empty EOF node.
    parserRuleSet: () => {
        const p = parserRuleSet(int, 'document')
        assertStructurallySame(p(cps('-12')), ['ok', [[[['minus', c('-')], ['positive', [c('1'), [c('2')]]]], []], 3]])
        assertStructurallySame(p(cps('0')), ['ok', [[[['none', []], ['zero', c('0')]], []], 1]])
        assertStructurallySame(p(cps('01')), ['error', 1])
        assertStructurallySame(p(cps('-')), ['error', 1])
        assertStructurallySame(p([]), ['error', 0])
    },
    // A rule the entry does not reach is dead, not wrong: the parser leaves
    // it out of its analysis, where `firstMap` over the whole set refuses it.
    dead: () => {
        /** @type {RuleSet} */
        const dead = { ...int, dead: ['sequence', 'dead'] }
        assertStructurallySame(parserRuleSet(dead, 'document')(cps('7')), ['ok', [[[['none', []], ['positive', [c('7'), []]]], []], 1]])
        // The item of a zero-bound repeat is never entered, so it is dead
        // too, whatever it is.
        assertStructurallySame(parserRuleSet({ start: ['repeat', 0, 0, 'dead'], dead: ['sequence', 'dead'] }, 'start')([]), ['ok', [[], 0]])
    },
    throw: {
        // A set that is no grammar is refused as `validate` refuses it, and
        // a grammar that is not LL(1) as `firstMap` does — before any input.
        deadInSet: () => firstMap({ ...int, dead: ['sequence', 'dead'] }),
        unknownEntry: () => parserRuleSet(int, 'float'),
        leftRecursion: () => parserRuleSet({ ...int, int: ['sequence', 'int', 'uint'] }, 'document'),
        firstFirstConflict: () => parser({ a: 'x', b: ['x', 'y'] }),
        // A rule that is no rule reaches the lowering's refusal.
        notARule: () => parser(/** @type {Rule} */ (/** @type {unknown} */ (true))),
        // The input holds ordinary symbols only: `-1` is the end of input,
        // which is synthesized after the input and not spelled in it, and a
        // fraction is no symbol.
        eofInInput: () => parser(eof)([-1]),
        notASymbol: () => parser(digit)([0.5]),
    },
}
