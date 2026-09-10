/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Ast, Meta } from '../ast/types.ts'
 * @import { Rule } from '../types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { Mappings, Parser } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { eof, join, literals, option, range, repeat, repeatFrom0, repeatFrom1, times } from '../module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { dataJs } from '../lib/datajs/module.f.mjs'
import { json } from '../lib/json/module.f.mjs'
import { firstMap, mapping, parser, parserRuleSet } from './module.f.mjs'

const { keys } = Object

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The metadata of a code point in a text parse with nothing to say about it:
 * the alphabet, one record shared by every leaf, so the parse allocates
 * nothing per symbol but the leaf the input already is.
 */
const cp = /**@type {const}*/({ id: 'cp' })

/** @type {(symbol: number) => Meta<typeof cp>} */
const sym = symbol => ({ symbol, meta: cp })

/** The leaf of one character. @type {(a: string) => Meta<typeof cp>} */
const s = a => sym(c(a))

/**
 * The input a text parser is given: the code points of a string, each with
 * the trivial metadata.
 *
 * @type {(s: string) => readonly Meta<typeof cp>[]}
 */
const cps = s => toArray(stringToCodePointList(s)).map(sym)

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

// The 207 example grammar in EBNF: a list of integers, `[-12,3]`, and the
// mappings that fold its tree to the integers — in one layer, straight from
// the text, and in two, through a token alphabet.

const digit = range('09')

const digits1 = repeatFrom1(digit)

const optionMinus = option('-')

const integer = /**@type {const}*/([optionMinus, digits1])

const list = /**@type {const}*/(['[', join(',')(integer), ']'])

// The token alphabet: what the text layer emits and the list layer reads.

const intToken = 0
const openToken = 1
const closeToken = 2
const commaToken = 3

/**
 * A token: its kind is the symbol, and its metadata names the alphabet and
 * carries an integer's value — `0` for a punctuation mark, which has none.
 *
 * @type {(symbol: number, value: number) => Meta<{ readonly id: 'tok', readonly value: number }>}
 */
const token = (symbol, value) => ({ symbol, meta: { id: 'tok', value } })

/** @type {(value: readonly number[]) => Meta<{ readonly id: 'list', readonly value: readonly number[] }>} */
const listToken = value => ({ symbol: 0, meta: { id: 'list', value } })

/**
 * The node at a position no mapping filled: a symbol is the only non-array
 * in a tree, so this is the one test a mapping makes where it knows the
 * position is unmapped — the scaffolding `join` builds, say, which it hands
 * to nobody.
 *
 * @type {<T extends readonly unknown[]>(node: T | Meta<unknown>) => T}
 */
const unmapped = node => {
    assert(node instanceof Array)
    return node
}

/**
 * The value at a position an integer mapping filled: the position was
 * mapped, so it is a symbol and no array, and its alphabet is the token
 * layer's, so it carries a value. The one test a mapping needs, and the
 * `id` it reads.
 *
 * @type {(node:
 *  | Meta<
 *      | { readonly id: 'tok', readonly value: number }
 *      | { readonly id: 'list', readonly value: readonly number[] }
 *      | typeof cp>
 *  | readonly unknown[]) => number}
 */
const intValue = node => {
    assert(!(node instanceof Array))
    const { meta } = node
    assert(meta.id === 'tok')
    return meta.value
}

/**
 * @type {(node:
 *  | Meta<
 *      | { readonly id: 'tok', readonly value: number }
 *      | { readonly id: 'list', readonly value: readonly number[] }>
 *  | readonly unknown[]) => readonly number[]}
 */
const listValue = node => {
    assert(!(node instanceof Array))
    const { meta } = node
    assert(meta.id === 'list')
    return meta.value
}

/**
 * The text layer's mappings for an integer, bound once to the layer's
 * metadata — code points in, tokens out — so each function is typed from
 * its rule: a digit is one symbol, `digits1` a non-empty list of positions
 * the digit mapping filled, the sign an option, and `integer` the pair.
 *
 * @type {Mappings<typeof cp, { readonly id: 'tok', readonly value: number }>}
 */
const tok = mapping

const integerMappings = [
    tok(digit, d => token(intToken, d.symbol - c('0'))),
    tok(digits1, ds => token(intToken, ds.reduce((n, d) => n * 10 + intValue(d), 0))),
    tok(optionMinus, m => token(intToken, m.length === 0 ? 1 : -1)),
    tok(integer, ([m, n]) => token(intToken, intValue(m) * intValue(n))),
]

/**
 * One layer: the list's own mapping beside the integer's, under a wider
 * output — a set is assembled from parts, and a part's output type is
 * carried into the union. `join` builds the separator-item pairs inside
 * itself and hands them to nobody, so the list reads them as they are: a
 * comma's code points beside an already-mapped integer.
 *
 * @type {Mappings<typeof cp, { readonly id: 'tok', readonly value: number } | { readonly id: 'list', readonly value: readonly number[] }>}
 */
const lst = mapping

const parseList = parser(list, [
    ...integerMappings,
    lst(list, ([, o]) => {
        // The option `join` builds is empty or holds the first item beside
        // the separator-item pairs; each item is a position the integer
        // mapping filled, and everything around it is scaffolding no
        // mapping did.
        const option = unmapped(o)
        if (option.length === 0) { return listToken([]) }
        const [first, rest] = unmapped(option[0])
        return listToken([intValue(first), ...unmapped(rest).map(pair => intValue(unmapped(pair)[1]))])
    }),
])

// Two layers: a tokenizer over the text, then the list grammar over tokens.

const punctuation = /**@type {const}*/({ open: '[', close: ']', comma: ',' })

const punctuationToken = /**@type {const}*/({ open: openToken, close: closeToken, comma: commaToken })

/**
 * The token layer's grammar, left-factored: an integer may only be followed
 * by a punctuation mark or the end, since a digit after `digits1` would be
 * a first/follow conflict — the next integer's, or one more round of this
 * one's — which the backend refuses.
 */
const tokens = /**@type {const}*/([option(integer), repeatFrom0([punctuation, option(integer)])])

const parseTokens = parser(tokens, [
    ...integerMappings,
    tok(punctuation, ([tag]) => token(punctuationToken[tag], 0)),
])

/**
 * The boundary: every token is a mapped position, so the entry's node holds
 * the symbols of the token alphabet, in order, between the scaffolding the
 * left-factoring put around them — and once read out of it, they are the
 * next layer's input as they are, no renaming and no re-tagging.
 *
 * @type {(node: Ast<typeof tokens, typeof cp, { readonly id: 'tok', readonly value: number }>) =>
 *  readonly Meta<{ readonly id: 'tok', readonly value: number }>[]}
 */
const tokenSymbols = node => {
    /** @type {(t: Meta<{ readonly id: 'tok', readonly value: number }> | readonly unknown[]) => Meta<{ readonly id: 'tok', readonly value: number }>} */
    const symbol = t => {
        assert(!(t instanceof Array))
        return t
    }
    const [first, rest] = unmapped(node)
    return [
        ...unmapped(first).map(symbol),
        ...unmapped(rest).flatMap(round => {
            const [mark, integer] = unmapped(round)
            return [symbol(mark), ...unmapped(integer).map(symbol)]
        }),
    ]
}

const tokenList = /**@type {const}*/([openToken, join(commaToken)(intToken), closeToken])

/**
 * The list layer's one mapping, over tokens: an integer is the value its
 * token carries.
 *
 * @type {Mappings<{ readonly id: 'tok', readonly value: number }, { readonly id: 'list', readonly value: readonly number[] }>}
 */
const val = mapping

const parseTokenList = parser(tokenList, [
    val(tokenList, ([, o]) => {
        // The option `join` builds is empty or holds the first item beside
        // the separator-item pairs; each item is a position an integer
        // token stands at, and everything around it is scaffolding no
        // mapping did.
        const option = unmapped(o)
        if (option.length === 0) { return listToken([]) }
        const [first, rest] = unmapped(option[0])
        return listToken([intValue(first), ...unmapped(rest).map(pair => intValue(unmapped(pair)[1]))])
    }),
])

/** @type {(text: string) => readonly number[]} */
const integers = text => {
    const [tokens] = unwrap(parseTokens(cps(text)))
    const [ast] = unwrap(parseTokenList(tokenSymbols(tokens)))
    return listValue(ast)
}

/**
 * The word under a node: its input symbols in order, a variant's tag
 * passed over.
 *
 * @type {(node: Ast<Rule, unknown> | string) => string}
 */
const word = node =>
    typeof node === 'string' ? '' :
    node instanceof Array ? node.map(word).join('') :
    String.fromCodePoint(node.symbol)

/** The punctuators of JavaScript. */
const punctuators = [
    '{', '}', '(', ')', '[', ']', '.', '...', ';', ',', '<', '>', '<=', '>=', '==', '!=', '===', '!==',
    '+', '-', '*', '%', '**', '++', '--', '<<', '>>', '>>>', '&', '|', '^', '!', '~', '&&', '||', '??',
    '?', '?.', ':', '=', '+=', '-=', '*=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=',
    '||=', '??=', '=>', '/', '/=',
]

/** A JSON document is the grammar's `json` rule, then the end of input. */
const document = /**@type {const}*/([json, eof])

const parseJson = parser(json)

const parseDocument = parser(document)

const parseDataJs = parser(dataJs)

// A JSON number is `[optionNeg, uint, ...optionFloatSuffix]`: no minus, the
// `onenine` branch of `uint` with no further digits, no fraction, no
// exponent.
const one1 = /**@type {const}*/(['number', [[], ['onenine', [s('1'), []]], [], []]])

// `[1]`: the whitespace runs are empty; the array is its bracket, whitespace,
// one item — the option `join` builds holds the item, its whitespace, and no
// separator-item pairs — and its bracket.
const array1 = /**@type {const}*/(['array', [[s('[')], [], [[[one1, []], []]], [s(']')]]])

/** @type {Ast<typeof json, typeof cp>} */
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
    // A tree per form, as `Ast<R, I>` gives it.
    parser: {
        // A set's node is the input symbol, metadata and all; a symbol
        // outside the set fails at its index, and so does the end of input,
        // at the length.
        set: () => {
            const p = parser(digit)
            assertStructurallySame(p([s('5')]), ['ok', [s('5'), 1]])
            assertStructurallySame(p([s('a')]), ['error', 0])
            assertStructurallySame(p([]), ['error', 0])
        },
        // A leaf is the input's own element, so whatever the caller knows
        // about a symbol — a position, say — is in the tree where the symbol
        // is, and nothing was allocated to put it there.
        metadata: () => {
            const input = [...'ab'].map((a, pos) => ({ symbol: c(a), meta: { id: 'cp', pos } }))
            const [ast] = unwrap(parser('ab')(input))
            assertStructurallySame(ast, input)
            assert(ast[0] === input[0] && ast[1] === input[1])
        },
        // The end of input is synthesized once, after the last symbol, and
        // its node is empty. It is not available before the end, and after
        // it was consumed there is no symbol at all: a second EOF fails, a
        // variant has nothing to select on, and an optional rule matches
        // zero rounds. Consuming it does not move the public index.
        eof: () => {
            assertStructurallySame(parser(eof)([]), ['ok', [[], 0]])
            assertStructurallySame(parser(eof)([s('A')]), ['error', 0])
            assertStructurallySame(parser([range('AA'), eof])([s('A')]), ['ok', [[s('A'), []], 1]])
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
            assertStructurallySame(two(cps('12')), ['ok', [[s('1'), s('2')], 2]])
            assertStructurallySame(two(cps('123')), ['ok', [[s('1'), s('2')], 2]])
            assertStructurallySame(two(cps('1')), ['error', 1])
            assertStructurallySame(two(cps('1x')), ['error', 1])
            const oneOrTwo = parser(repeat(1, 2)(digit))
            assertStructurallySame(oneOrTwo(cps('1x')), ['ok', [[s('1')], 1]])
            assertStructurallySame(oneOrTwo(cps('12x')), ['ok', [[s('1'), s('2')], 2]])
            const any = parser(repeatFrom0(digit))
            assertStructurallySame(any([]), ['ok', [[], 0]])
            assertStructurallySame(any(cps('123x')), ['ok', [[s('1'), s('2'), s('3')], 3]])
            assertStructurallySame(parser(repeatFrom1(digit))([]), ['error', 0])
        },
        // The rule's literal type survives the call — `R` is a `const` type
        // parameter — so the parser is typed by the tree the rule builds,
        // with nothing mapped and nothing known of the input's metadata.
        // The assertion is what makes the modifier load-bearing: dropping it
        // would widen every inline rule silently and `tsc` would still pass.
        constParameter: () => {
            const p = parser({ a: 'x', b: ['y', 42] })
            /** @typedef {Assert<Equal<typeof p, Parser<readonly ['a', readonly Meta<unknown>[]] | readonly ['b', readonly [readonly Meta<unknown>[], Meta<unknown, 42>]], unknown>>>} _ConstParameter */
            assertStructurallySame(p(cps('y*')), ['ok', [['b', [cps('y'), sym(42)]], 2]])
        },
        // A nullable item under a bounded repeat, as `../data` promises: a
        // forced round matches empty, so `times(3)('')` matches empty three
        // times, and an optional round never starts on it, so `option('')`
        // matches it zero times.
        repeatNullable: () => {
            assertStructurallySame(parser(times(3)(''))([]), ['ok', [[[], [], []], 0]])
            assertStructurallySame(parser(option(''))([]), ['ok', [[], 0]])
        },
        // A rule that can match empty is entered exactly when the lookahead
        // is in its first set, so what follows it may begin with anything
        // else — and the conflict, where it may begin with the same symbol,
        // is refused when the parser is built, below.
        firstFollow: () => {
            const p = parser([option('x'), 'y'])
            assertStructurallySame(p(cps('y')), ['ok', [[[], cps('y')], 1]])
            assertStructurallySame(p(cps('xy')), ['ok', [[[cps('x')], cps('y')], 2]])
        },
        // A repetition every round of which is forced decides nothing, so
        // what follows it may begin with what its item does.
        forcedRounds: () => {
            const p = parser([times(2)('x'), 'x'])
            assertStructurallySame(p(cps('xxx')), ['ok', [[[cps('x'), cps('x')], cps('x')], 3]])
        },
        // A match begins at the index the caller passes and reports the
        // input's own indices, so the caller resumes where the last match
        // ended. The end of input is at the length from anywhere: `eof`
        // matches there and nowhere before it.
        start: () => {
            const p = parser(digits1)
            assertStructurallySame(p(cps('12 34'), 3), ['ok', [[s('3'), s('4')], 5]])
            assertStructurallySame(p(cps('12 34'), 2), ['error', 2])
            assertStructurallySame(p(cps('12 34'), 5), ['error', 5])
            assertStructurallySame(parser(eof)(cps('1'), 1), ['ok', [[], 1]])
            assertStructurallySame(parser(eof)(cps('1'), 0), ['error', 0])
        },
        // A symbol is checked where the parse reads it, so one the match
        // never reaches is never refused — a scan of the whole input up
        // front would be paid once per token by a layer that resumes.
        unread: () => {
            assertStructurallySame(parser(digit)([s('1'), sym(0.5)]), ['ok', [s('1'), 1]])
        },
        // A prefix tree is read greedily: an optional round starts whenever
        // the lookahead continues a word, so the longest word matches, and
        // a word nothing continues stops where it ends. The word read is
        // the symbols under the node.
        literals: () => {
            const p = parser(literals(['=', '==', '===', '=>', '!', '!=']))
            /** @type {(text: string) => readonly [string, number]} */
            const read = text => {
                const [node, end] = unwrap(p(cps(text)))
                return [word(node), end]
            }
            assertStructurallySame(read('==='), ['===', 3])
            assertStructurallySame(read('==x'), ['==', 2])
            assertStructurallySame(read('=>='), ['=>', 2])
            assertStructurallySame(read('!'), ['!', 1])
            assertStructurallySame(read('!x'), ['!', 1])
            assertStructurallySame(p(cps('?')), ['error', 0])
            assertStructurallySame(p(cps('')), ['error', 0])
            // The punctuators of JavaScript, sharing prefixes throughout,
            // are one LL(1) rule this way — the list a tokenizer's operator
            // variant cannot be.
            assertStructurallySame(unwrap(parser(literals(punctuators))(cps('>>>=')))[1], 4)
        },
    },
    // The rewrite set, folded into the parse: a mapped rule's node is handed
    // to its mapping as it comes into existence, and what the mapping
    // returns stands in its place.
    mapping: {
        // The example grammar, parsed and mapped in one layer: the list's
        // node is the one symbol its mapping returned, carrying the integers.
        // The parser is typed by the layer's metadata, read off the set.
        integers: () => {
            /** @typedef {Assert<Equal<typeof parseList, Parser<Ast<typeof list, typeof cp, { readonly id: 'tok', readonly value: number } | { readonly id: 'list', readonly value: readonly number[] }>, typeof cp>>>} _Typed */
            const [ast] = unwrap(parseList(cps('[-12,3]')))
            assertStructurallySame(ast, listToken([-12, 3]))
            assertStructurallySame(listValue(unwrap(parseList(cps('[]')))[0]), [])
            assertStructurallySame(parseList(cps('[1,]')), ['error', 3])
        },
        // The same, in two layers: the text layer's entry is a repetition of
        // tokens, each round mapped, so its node is the token list the layer
        // above reads as its input, and that layer's mapping reads the value
        // a token carries.
        layers: () => {
            const [tokens] = unwrap(parseTokens(cps('[-12,3]')))
            assertStructurallySame(tokens, [[], [
                [token(openToken, 0), [token(intToken, -12)]],
                [token(commaToken, 0), [token(intToken, 3)]],
                [token(closeToken, 0), []],
            ]])
            assertStructurallySame(tokenSymbols(tokens), [
                token(openToken, 0), token(intToken, -12), token(commaToken, 0), token(intToken, 3), token(closeToken, 0),
            ])
            assertStructurallySame(integers('[-12,3]'), [-12, 3])
            assertStructurallySame(integers('[]'), [])
            assertStructurallySame(integers('[7]'), [7])
        },
        // The same token layer with no whole-file grammar: a one-token
        // grammar, resumed once per token from where the last one ended.
        // `repeatFrom0(token)` is refused — the digits of an integer may be
        // followed by the next token's, a first/follow conflict — but one
        // token at a time has nothing required after it, and the loop that
        // resumes the parser is the layer, left-factoring and all.
        resumed: () => {
            const oneToken = { integer, punctuation }
            const parseToken = parser(oneToken, [
                ...integerMappings,
                tok(punctuation, ([tag]) => token(punctuationToken[tag], 0)),
            ])
            /** @type {(input: readonly Meta<typeof cp>[]) => readonly Meta<{ readonly id: 'tok', readonly value: number }>[]} */
            const lex = input => {
                /** @type {readonly Meta<{ readonly id: 'tok', readonly value: number }>[]} */
                let out = []
                let pos = 0
                while (pos < input.length) {
                    const [ast, end] = unwrap(parseToken(input, pos))
                    const [, symbol] = unmapped(ast)
                    assert(!(symbol instanceof Array))
                    out = [...out, symbol]
                    pos = end
                }
                return out
            }
            const text = '[-12,3]'
            assertStructurallySame(lex(cps(text)), tokenSymbols(unwrap(parseTokens(cps(text)))[0]))
            assertStructurallySame(listValue(unwrap(parseTokenList(lex(cps(text))))[0]), [-12, 3])
            assertStructurallySame(lex([]), [])
        },
        // The empty set is the identity: nothing is mapped, so the tree is
        // the parser's own — and the type says so by definition, `Ast<R, I>`
        // being `Ast<R, I, never>`.
        identity: () => {
            const text = ' [1.5e-3, {"a\\u00e9\\n": null, "": [true, false]}, "x"] '
            const input = cps(text)
            assertStructurallySame(parser(json, [])(input), parseJson(input))
            assertStructurallySame(parser(list, [])(cps('[-12,3]')), parser(list)(cps('[-12,3]')))
        },
        // A node comes into existence at five sites, and each hands it to
        // its mapping: a set's leaf, the empty sequence, the end of a
        // sequence, the variant wrap, and the closing of a repetition. Each
        // mapping receives the node with the rules under it already mapped.
        sites: () => {
            const empty = ''
            const pair = /**@type {const}*/([digit, empty])
            const choice = { pair }
            const rounds = times(1)(choice)
            /** @type {(value: string) => Meta<{ readonly id: 'site', readonly value: string }>} */
            const site = value => ({ symbol: 0, meta: { id: 'site', value } })
            /** @type {(node: Meta<{ readonly id: 'site', readonly value: string } | typeof cp> | readonly unknown[]) => string} */
            const at = node => {
                assert(!(node instanceof Array))
                assert(node.meta.id === 'site')
                return node.meta.value
            }
            /** @type {Mappings<typeof cp, { readonly id: 'site', readonly value: string }>} */
            const map = mapping
            const p = parser(rounds, [
                map(digit, d => site(`leaf ${d.symbol - c('0')}`)),
                map(empty, e => site(`empty ${e.length}`)),
                map(pair, ([d, e]) => site(`pair(${at(d)}, ${at(e)})`)),
                map(choice, ([tag, node]) => site(`${tag}: ${at(node)}`)),
                map(rounds, rs => site(`rounds[${rs.map(at).join(', ')}]`)),
            ])
            assertStructurallySame(p(cps('7')), ['ok', [site('rounds[pair: pair(leaf 7, empty 0)]'), 1]])
        },
        // A rule with no mapping keeps its node, the rules under it mapped;
        // and a mapping's result may be a symbol of this layer's own input
        // alphabet, as an unmapped leaf is.
        partial: () => {
            const p = parser([digit, digit], [tok(digit, d => token(intToken, d.symbol - c('0')))])
            assertStructurallySame(p(cps('42')), ['ok', [[token(intToken, 4), token(intToken, 2)], 2]])
            const q = parser([digit, digit], [mapping(digit, d => sym(d.symbol + 1))])
            assertStructurallySame(q(cps('42')), ['ok', [[s('5'), s('3')], 2]])
        },
        // A key is the rule the author holds, by identity: a tuple spelled
        // twice is two rules, and only the held instance is mapped.
        identityKeyed: () => {
            const a = /**@type {const}*/(['x'])
            const b = /**@type {const}*/(['x'])
            const p = parser([a, b], [mapping(a, () => sym(0))])
            assertStructurallySame(p(cps('xx')), ['ok', [[sym(0), [cps('x')]], 2]])
        },
        // A string's symbol and a bare number are one rule in the data
        // layer, so mapping the number maps the code point inside the string
        // too. A grammar that wants them apart spells the string as a set.
        symbolShared: () => {
            const p = parser(['a', c('a')], [mapping(c('a'), () => sym(0))])
            assertStructurallySame(p(cps('aa')), ['ok', [[[sym(0)], sym(0)], 2]])
            const q = parser(['a', range('aa')], [mapping(c('a'), () => sym(0))])
            assertStructurallySame(q(cps('aa')), ['ok', [[[sym(0)], s('a')], 2]])
        },
        // A `const` thunk and its payload are one rule, keyed by the thunk:
        // the thunk's mapping receives the payload's node. The payload is
        // held nowhere else, so it has no name and is no key, below.
        constThunk: () => {
            const payload = /**@type {const}*/([digit])
            /** @type {() => readonly ['const', typeof payload]} */
            const thunk = () => ['const', payload]
            const p = parser(thunk, [mapping(thunk, ([d]) => d)])
            assertStructurallySame(p(cps('7')), ['ok', [s('7'), 1]])
        },
    },
    // The `lib` grammars are LL(1), and the parser built for them stops
    // where the grammar does.
    json: {
        // A small document, pinned node by node.
        array: () => {
            assertStructurallySame(parseJson(cps('[1]')), ['ok', [json1, 3]])
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
        // 10000 rounds long, both match. The fold adds no depth: a mapping
        // is applied where the node is built, in the same loop.
        deep: () => {
            const n = 5000
            assertEq(unwrap(parseDocument(cps('['.repeat(n) + ']'.repeat(n))))[1], 2 * n)
            assertEq(unwrap(parseDocument(cps(`${' '.repeat(10000)}1`)))[1], 10001)
            assertEq(integers(`[${Array.from({ length: n }, (_, i) => i).join(',')}]`).length, n)
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
        assertStructurallySame(p(cps('-12')), ['ok', [[[['minus', s('-')], ['positive', [s('1'), [s('2')]]]], []], 3]])
        assertStructurallySame(p(cps('0')), ['ok', [[[['none', []], ['zero', s('0')]], []], 1]])
        assertStructurallySame(p(cps('01')), ['error', 1])
        assertStructurallySame(p(cps('-')), ['error', 1])
        assertStructurallySame(p([]), ['error', 0])
    },
    // A rule the entry does not reach is dead, not wrong: the parser leaves
    // it out of its analysis, where `firstMap` over the whole set refuses it.
    dead: () => {
        /** @type {RuleSet} */
        const dead = { ...int, dead: ['sequence', 'dead'] }
        assertStructurallySame(parserRuleSet(dead, 'document')(cps('7')), ['ok', [[[['none', []], ['positive', [s('7'), []]]], []], 1]])
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
        // A rule that can match empty, followed by what it begins with: an
        // option, a repetition from zero, a variant with an empty branch,
        // an option two rules deep — its follow set reaches it through the
        // sequence it ends — and an option repeated, where the round that
        // follows a round begins with what the option does.
        firstFollowConflict: () => parser([option('x'), 'x']),
        firstFollowConflictRepeat: () => parser([repeatFrom0('x'), 'x']),
        firstFollowConflictVariant: () => parser([{ a: 'x', n: '' }, 'x']),
        firstFollowConflictNested: () => parser([['y', option('x')], 'x']),
        firstFollowConflictRounds: () => parser(times(2)(option('x'))),
        // A repetition with a round to spare decides on its item too,
        // though it must match once and so is no nullable rule.
        firstFollowConflictOptionalRound: () => parser([repeat(1, 2)('x'), 'x']),
        firstFollowConflictUnboundedRound: () => parser([repeatFrom1('x'), 'x']),
        // A rule that is no rule reaches the lowering's refusal.
        notARule: () => parser(/** @type {Rule} */ (/** @type {unknown} */ (true))),
        // The set is refused before any input, as the grammar is: a mapping
        // keyed by a rule the grammar does not hold — a look-alike of one it
        // does, or a `const` thunk's payload, which has no name of its own —
        // and a rule mapped twice, which would let assembly order decide.
        unknownRule: () => parser(digit, [mapping(range('09'), d => d)]),
        constPayload: () => {
            const payload = /**@type {const}*/([digit])
            /** @type {() => readonly ['const', typeof payload]} */
            const thunk = () => ['const', payload]
            return parser(thunk, [mapping(payload, ([d]) => d)])
        },
        mappedTwice: () => parser(digit, [mapping(digit, d => d), mapping(digit, d => d)]),
        // The input holds ordinary symbols only: `-1` is the end of input,
        // which is synthesized after the input and not spelled in it, and a
        // fraction is no symbol.
        eofInInput: () => parser(eof)([sym(-1)]),
        notASymbol: () => parser(digit)([sym(0.5)]),
        // Read as lookahead is read: an optional round decides on it.
        notASymbolLookahead: () => parser(repeatFrom0(digit))([s('1'), sym(0.5)]),
        // The start index is the input's own: not negative, not a fraction,
        // and at most the length, where only the end of input is left.
        startNegative: () => parser(digit)(cps('1'), -1),
        startFraction: () => parser(digit)(cps('1'), 0.5),
        startPastEnd: () => parser(digit)(cps('1'), 2),
        // A whole-file token grammar: an integer's digits may be followed by
        // the next integer's, and the backend refuses it, so a token layer
        // resumes a one-token parser instead (`mapping.resumed`).
        tokenRepeat: () => parser(repeatFrom0({ integer, punctuation })),
        // What follows a prefix tree may not continue one of its words: `ab`
        // would read two ways, and the backend says so before any input.
        literalsFollow: () => parser([literals(['a', 'ab']), 'b']),
    },
}
