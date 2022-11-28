const operator = require('../types/function/operator/module.f.cjs')
const range_map = require('../types/range_map/module.f.cjs')
const { merge, fromRange } = range_map
const { reduce } = require('../types/list/module.f.cjs')
const { range: ascii } = require('../text/ascii/module.f.cjs')
const { fromCharCode } = String
const { fn } = require('../types/function/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const _range = require('../types/range/module.f.cjs')
const { one } = _range
const { toArray, map } = list

/** @typedef {readonly string[]} State */

/** @typedef {(a: number) => State} NextState */

/** @type {NextState} */
const unknownSymbol = a => [`unknown symbol ${a}`]

/** @type {operator.Reduce<NextState>} */
const union = a => b => {
    if (a === unknownSymbol || a === b) { return b }
    if (b === unknownSymbol) { return a }
    throw [a, b]
}

const mapMerge = merge({
    union,
    equal: operator.strictEqual,
})

/** @type {range_map.RangeMap<NextState>} */
const empty = []

const mapReduce = fn(reduce(mapMerge)(empty)).then(toArray).result

const codePointRange = fromRange(unknownSymbol)

const range = fn(ascii).then(codePointRange).result

/** @type {(l: readonly _range.Range[]) => (f: NextState) => range_map.RangeMapArray<NextState>} */
const rangeSet = l => f => {
    /** @type {(r: _range.Range) => range_map.RangeMap<NextState>} */
    const g = r => codePointRange(r)(f)
    return mapReduce(map(g)(l))
}

const terminal = -1

/** @type {NextState} */
const idBegin = c => [fromCharCode(c)]

const whiteSpace = () =>[' ']

const newLine = () => ['\n']

// proposal # 1
// - range('az') => [['a', 'z']]
// - set('ad')   => [['a', 'a'], ['d', 'd']]
// - union([range('AZ'), set('_$'), range('az')]) => [['_', '_'], ['$', '$'], ['A', 'Z'], ['a', 'z']]
// proposal # 2
// - 'A-Z_$a-z' => [['_', '_'], ['$', '$'], ['A', 'Z'], ['a', 'z']]
// - '\\-'       => [['-', '-']]

const init = mapReduce([
    codePointRange(one(terminal))(() => []),
    rangeSet([ascii('\t'), ascii(' ')])(whiteSpace),
    rangeSet([ascii('\n'), ascii('\r')])(newLine),
    range('!')(() => ['!']),
    range('"')(() => ['"']),
    rangeSet([ascii('$'), ascii('_'), ascii('AZ'), ascii('az')])(idBegin),
    range('%')(() => ['%']),
    range('&')(() => ['&']),
    range("'")(() => ["'"]),
    range('(')(() => ['(']),
    range(')')(() => [')']),
    range('*')(() => ['*']),
    range('+')(() => ['+']),
    range(',')(() => [',']),
    range('-')(() => ['-']),
    range('.')(() => ['.']),
    range('/')(() => ['/']),
    range('09')(a => [fromCharCode(a)]),
    range(':')(() => [':']),
    range(';')(() => [';']),
    range('<')(() => ['<']),
    range('=')(() => ['=']),
    range('>')(() => ['>']),
    range('?')(() => ['?']),
    range('[')(() => ['[']),
    range(']')(() => [']']),
    range('^')(() => ['^']),
    range('`')(() => ['`']),
    range('{')(() => ['{']),
    range('|')(() => ['|']),
    range('}')(() => ['}']),
    range('~')(() => ['~']),
])

module.exports = {
    /** @readonly */
    unknownSymbol,
    /** @readonly */
    init,
}
