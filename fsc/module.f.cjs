const operator = require('../types/function/operator/module.f.cjs')
const range_map = require('../types/range_map/module.f.cjs')
const { merge, fromOne, fromRange } = range_map
const { reduce } = require('../types/list/module.f.cjs')
const { one: asciiOne, range: asciiRange } = require('../text/ascii/module.f.cjs')
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

const codePoint = fromOne(unknownSymbol)

const one = fn(asciiOne).then(codePoint).result

const codePointRange = fromRange(unknownSymbol)

const range = fn(asciiRange).then(codePointRange).result

/** @type {(f: NextState) => (l: list.List<_range.Range>) => range_map.RangeMapArray<NextState>} */
const rangeReduce = f => l => {
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
    codePoint(terminal)(() => []),
    one('\t')(whiteSpace),
    one('\n')(newLine),
    one('\r')(newLine),
    one(' ')(whiteSpace),
    one('!')(() => ['!']),
    one('"')(() => ['"']),
    one('$')(idBegin),
    one('%')(() => ['%']),
    one('&')(() => ['&']),
    one("'")(() => ["'"]),
    one('(')(() => ['(']),
    one(')')(() => [')']),
    one('*')(() => ['*']),
    one('+')(() => ['+']),
    one(',')(() => [',']),
    one('-')(() => ['-']),
    one('.')(() => ['.']),
    one('/')(() => ['/']),
    range('09')(a => [fromCharCode(a)]),
    one(':')(() => [':']),
    one(';')(() => [';']),
    one('<')(() => ['<']),
    one('=')(() => ['=']),
    one('>')(() => ['>']),
    one('?')(() => ['?']),
    range('AZ')(idBegin),
    one('[')(() => ['[']),
    one(']')(() => [']']),
    one('^')(() => ['^']),
    one('_')(idBegin),
    one('`')(() => ['`']),
    range('az')(idBegin),
    one('{')(() => ['{']),
    one('|')(() => ['|']),
    one('}')(() => ['}']),
    one('~')(() => ['~']),
])

module.exports = {
    /** @readonly */
    unknownSymbol,
    /** @readonly */
    init,
}
