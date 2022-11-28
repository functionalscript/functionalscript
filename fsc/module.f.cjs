const operator = require('../types/function/operator/module.f.cjs')
const range_map = require('../types/range_map/module.f.cjs')
const { merge, fromOne, fromRange } = range_map
const { reduce } = require('../types/list/module.f.cjs')
const { one, range } = require('../text/ascii/module.f.cjs')
const { fromCharCode } = String
const { fn } = require('../types/function/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const _range = require('../types/range/module.f.cjs')
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

const cp = fromOne(unknownSymbol)

const c = fn(one).then(cp).result

const cpRange = fromRange(unknownSymbol)

const cRange = fn(range).then(cpRange).result

/** @type {(f: NextState) => (l: list.List<_range.Range>) => range_map.RangeMapArray<NextState>} */
const rangeReduce = f => l => {
    /** @type {(r: _range.Range) => range_map.RangeMap<NextState>} */
    const g = r => cpRange(r)(f)
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
// - 'A-Z_$a-z'
// - '\-'

const init = mapReduce([
    cp(terminal)(() => []),
    c('\t')(whiteSpace),
    c('\n')(newLine),
    c('\r')(newLine),
    c(' ')(whiteSpace),
    c('!')(() => ['!']),
    c('"')(() => ['"']),
    c('$')(idBegin),
    c('%')(() => ['%']),
    c('&')(() => ['&']),
    c("'")(() => ["'"]),
    c('(')(() => ['(']),
    c(')')(() => [')']),
    c('*')(() => ['*']),
    c('+')(() => ['+']),
    c(',')(() => [',']),
    c('-')(() => ['-']),
    c('.')(() => ['.']),
    c('/')(() => ['/']),
    cRange('09')(a => [fromCharCode(a)]),
    c(':')(() => [':']),
    c(';')(() => [';']),
    c('<')(() => ['<']),
    c('=')(() => ['=']),
    c('>')(() => ['>']),
    c('?')(() => ['?']),
    cRange('AZ')(idBegin),
    c('[')(() => ['[']),
    c(']')(() => [']']),
    c('^')(() => ['^']),
    c('_')(idBegin),
    c('`')(() => ['`']),
    cRange('az')(idBegin),
    c('{')(() => ['{']),
    c('|')(() => ['|']),
    c('}')(() => ['}']),
    c('~')(() => ['~']),
])

module.exports = {
    /** @readonly */
    unknownSymbol,
    /** @readonly */
    init,
}
