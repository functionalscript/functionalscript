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

/** @typedef {readonly[readonly string[], State]} Result */

/** @typedef {(a: number) => Result} ToResult */

/** @typedef {range_map.RangeMapArray<ToResult>} State */

/** @type {ToResult} */
const unknownSymbol = a => [[`unknown symbol ${a}`], empty]

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
    codePointRange(one(terminal))(() => [[], empty]),
    rangeSet(['\t', ' '])(() => [[' '], empty]),
    rangeSet(['\n', '\r'])(() => [['\n'], empty]),
    range('!')(() => [['!'], empty]),
    range('"')(() => [['"'], empty]),
    rangeSet(['$', '_', 'AZ', 'az'])(c => [[fromCharCode(c)], empty]),
    range('%')(() => [['%'], empty]),
    range('&')(() => [['&'], empty]),
    range("'")(() => [["'"], empty]),
    range('(')(() => [['('], empty]),
    range(')')(() => [[')'], empty]),
    range('*')(() => [['*'], empty]),
    range('+')(() => [['+'], empty]),
    range(',')(() => [[','], empty]),
    range('-')(() => [['-'], empty]),
    range('.')(() => [['.'], empty]),
    range('/')(() => [['/'], empty]),
    range('09')(a => [[fromCharCode(a)], empty]),
    range(':')(() => [[':'], empty]),
    range(';')(() => [[';'], empty]),
    range('<')(() => [['<'], empty]),
    range('=')(() => [['='], empty]),
    range('>')(() => [['>'], empty]),
    range('?')(() => [['?'], empty]),
    range('[')(() => [['['], empty]),
    range(']')(() => [[']'], empty]),
    range('^')(() => [['^'], empty]),
    range('`')(() => [['`'], empty]),
    range('{')(() => [['{'], empty]),
    range('|')(() => [['|'], empty]),
    range('}')(() => [['}'], empty]),
    range('~')(() => [['~'], empty]),
])

module.exports = {
    /** @readonly */
    unknownSymbol,
    /** @readonly */
    init,
}
