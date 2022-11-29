const operator = require('../types/function/operator/module.f.cjs')
const range_map = require('../types/range_map/module.f.cjs')
const { merge: rangeMapMerge, fromRange, get } = range_map
const { reduce: listReduce } = require('../types/list/module.f.cjs')
const { range: asciiRange } = require('../text/ascii/module.f.cjs')
const { fromCharCode } = String
const { fn } = require('../types/function/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const _range = require('../types/range/module.f.cjs')
const { one } = _range
const { toArray, map } = list

/** @typedef {readonly[readonly string[], ToResult]} Result */

/** @typedef {(a: number) => Result} ToResult */

/**
 * @template T
 * @typedef {(state: T) => ToResult} CreateToResult
 */

/**
 * @template T
 * @typedef {range_map.RangeMapArray<CreateToResult<T>>} State
 */

/** @type {ToResult} */
const unknownSymbol = a => [[`unknown symbol ${a}`], unknownSymbol]

/** @type {<T>(a: T) => ToResult} */
const def = () => unknownSymbol

/** @type {<T>(a: CreateToResult<T>) => (b: CreateToResult<T>) => CreateToResult<T>} */
const union = a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

/** @type {readonly never[]} */
const empty = []

/** @type {<T>(a: list.List<State<T>>) => State<T>} */
const reduce = a => {
    /** @typedef {typeof a extends list.List<State<infer T>> ? T : never} T */
    /** @type {range_map.RangeMerge<CreateToResult<T>>} */
    const merge = rangeMapMerge({
        union,
        equal: operator.strictEqual,
    })
    return toArray(listReduce(merge)(empty)(a))
}


const codePointRange = fromRange(def)

const range = fn(asciiRange).then(codePointRange).result

/** @type {(l: readonly string[]) => <T>(f: CreateToResult<T>) => State<T>} */
const rangeSet = l => f => {
    /** @typedef {typeof f extends CreateToResult<infer T> ? T : never} T */
    /** @type {(a: _range.Range) => (f: CreateToResult<T>) => State<T>} */
    const codePointRange = fromRange(def)
    /** @type {(r: string) => State<T>} */
    const g = r => codePointRange(asciiRange(r))(f)
    return reduce(map(g)(l))
}

/** @type {<T>(a: list.List<State<T>>) => CreateToResult<T>} */
const create = a => {
    /** @typedef {typeof a extends list.List<State<infer T>> ? T : never} T */
    const i = reduce(a)
    /** @type {(v: number) => (i: State<T>) => (v: T) => ToResult} */
    const x = get(def)
    return v => c => x(c)(i)(v)(c)
}

const terminal = -1

const init = create([
    codePointRange(one(terminal))(() => () => [[], unknownSymbol]),
    rangeSet(['\t', ' '])(() => () => [[' '], unknownSymbol]),
    rangeSet(['\n', '\r'])(() => () => [['\n'], unknownSymbol]),
    range('!')(() => () => [['!'], unknownSymbol]),
    range('"')(() => () => [['"'], unknownSymbol]),
    rangeSet(['$', '_', 'AZ', 'az'])(() => c => [[fromCharCode(c)], unknownSymbol]),
    range('%')(() => () => [['%'], unknownSymbol]),
    range('&')(() => () => [['&'], unknownSymbol]),
    range("'")(() => () => [["'"], unknownSymbol]),
    range('(')(() => () => [['('], unknownSymbol]),
    range(')')(() => () => [[')'], unknownSymbol]),
    range('*')(() => () => [['*'], unknownSymbol]),
    range('+')(() => () => [['+'], unknownSymbol]),
    range(',')(() => () => [[','], unknownSymbol]),
    range('-')(() => () => [['-'], unknownSymbol]),
    range('.')(() => () => [['.'], unknownSymbol]),
    range('/')(() => () => [['/'], unknownSymbol]),
    range('09')(() => a => [[fromCharCode(a)], unknownSymbol]),
    range(':')(() => () => [[':'], unknownSymbol]),
    range(';')(() => () => [[';'], unknownSymbol]),
    range('<')(() => () => [['<'], unknownSymbol]),
    range('=')(() => () => [['='], unknownSymbol]),
    range('>')(() => () => [['>'], unknownSymbol]),
    range('?')(() => () => [['?'], unknownSymbol]),
    range('[')(() => () => [['['], unknownSymbol]),
    range(']')(() => () => [[']'], unknownSymbol]),
    range('^')(() => () => [['^'], unknownSymbol]),
    range('`')(() => () => [['`'], unknownSymbol]),
    range('{')(() => () => [['{'], unknownSymbol]),
    range('|')(() => () => [['|'], unknownSymbol]),
    range('}')(() => () => [['}'], unknownSymbol]),
    range('~')(() => () => [['~'], unknownSymbol]),
])

module.exports = {
    /** @readonly */
    init,
}
