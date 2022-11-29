const operator = require('../types/function/operator/module.f.cjs')
const range_map = require('../types/range_map/module.f.cjs')
const { merge: rangeMapMerge, fromRange } = range_map
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

/** @typedef {range_map.RangeMapArray<ToResult>} State */

/** @type {ToResult} */
const unknownSymbol = a => [[`unknown symbol ${a}`], unknownSymbol]

/** @type {operator.Reduce<ToResult>} */
const union = a => b => {
    if (a === unknownSymbol || a === b) { return b }
    if (b === unknownSymbol) { return a }
    throw [a, b]
}

const merge = rangeMapMerge({
    union,
    equal: operator.strictEqual,
})

/** @type {State} */
const empty = []

const reduce = fn(listReduce(merge)(empty)).then(toArray).result

const codePointRange = fromRange(unknownSymbol)

const range = fn(asciiRange).then(codePointRange).result

/** @type {(l: readonly string[]) => (f: ToResult) => State} */
const rangeSet = l => f => {
    /** @type {(r: string) => range_map.RangeMap<ToResult>} */
    const g = r => codePointRange(asciiRange(r))(f)
    return reduce(map(g)(l))
}

const terminal = -1

const init = reduce([
    codePointRange(one(terminal))(() => [[], unknownSymbol]),
    rangeSet(['\t', ' '])(() => [[' '], unknownSymbol]),
    rangeSet(['\n', '\r'])(() => [['\n'], unknownSymbol]),
    range('!')(() => [['!'], unknownSymbol]),
    range('"')(() => [['"'], unknownSymbol]),
    rangeSet(['$', '_', 'AZ', 'az'])(c => [[fromCharCode(c)], unknownSymbol]),
    range('%')(() => [['%'], unknownSymbol]),
    range('&')(() => [['&'], unknownSymbol]),
    range("'")(() => [["'"], unknownSymbol]),
    range('(')(() => [['('], unknownSymbol]),
    range(')')(() => [[')'], unknownSymbol]),
    range('*')(() => [['*'], unknownSymbol]),
    range('+')(() => [['+'], unknownSymbol]),
    range(',')(() => [[','], unknownSymbol]),
    range('-')(() => [['-'], unknownSymbol]),
    range('.')(() => [['.'], unknownSymbol]),
    range('/')(() => [['/'], unknownSymbol]),
    range('09')(a => [[fromCharCode(a)], unknownSymbol]),
    range(':')(() => [[':'], unknownSymbol]),
    range(';')(() => [[';'], unknownSymbol]),
    range('<')(() => [['<'], unknownSymbol]),
    range('=')(() => [['='], unknownSymbol]),
    range('>')(() => [['>'], unknownSymbol]),
    range('?')(() => [['?'], unknownSymbol]),
    range('[')(() => [['['], unknownSymbol]),
    range(']')(() => [[']'], unknownSymbol]),
    range('^')(() => [['^'], unknownSymbol]),
    range('`')(() => [['`'], unknownSymbol]),
    range('{')(() => [['{'], unknownSymbol]),
    range('|')(() => [['|'], unknownSymbol]),
    range('}')(() => [['}'], unknownSymbol]),
    range('~')(() => [['~'], unknownSymbol]),
])

module.exports = {
    /** @readonly */
    unknownSymbol,
    /** @readonly */
    init,
}
