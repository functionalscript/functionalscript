// @ts-self-types="./module.f.d.mts"
import * as operator from '../types/function/operator/module.f.mjs'
import * as rangeMap from '../types/range_map/module.f.mjs'
const { merge: rangeMapMerge, fromRange, get } = rangeMap
import * as list from '../types/list/module.f.mjs'
const { reduce: listReduce } = list
import * as ascii from '../text/ascii/module.f.mjs'
const { range: asciiRange } = ascii
const { fromCharCode } = String
import * as f from '../types/function/module.f.mjs'
const { fn } = f
import * as _range from '../types/range/module.f.mjs'
const { one } = _range
const { toArray, map } = list

/** @typedef {readonly[readonly string[], ToResult]} Result */

/** @typedef {(codePoint: number) => Result} ToResult */

/**
 * @template T
 * @typedef {(state: T) => ToResult} CreateToResult
 */

/**
 * @template T
 * @typedef {rangeMap.RangeMapArray<CreateToResult<T>>} State
 */

/** @type {ToResult} */
const unexpectedSymbol = codePoint => [[`unexpected symbol ${codePoint}`], unexpectedSymbol]

/** @type {<T>(state: T) => ToResult} */
const def = () => unexpectedSymbol

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
    /** @type {rangeMap.RangeMerge<CreateToResult<T>>} */
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

export const terminal = -1

/** @type {() => ToResult} */
const toInit = () => () => [[], init]

export const init = create([
    codePointRange(one(terminal))(toInit),
    rangeSet(['\t', ' ', '\n', '\r'])(toInit),
    range('!')(() => () => [['!'], unexpectedSymbol]),
    range('"')(() => () => [['"'], unexpectedSymbol]),
    rangeSet(['$', '_', 'AZ', 'az'])(() => c => [[fromCharCode(c)], unexpectedSymbol]),
    range('%')(() => () => [['%'], unexpectedSymbol]),
    range('&')(() => () => [['&'], unexpectedSymbol]),
    range("'")(() => () => [["'"], unexpectedSymbol]),
    range('(')(() => () => [['('], unexpectedSymbol]),
    range(')')(() => () => [[')'], unexpectedSymbol]),
    range('*')(() => () => [['*'], unexpectedSymbol]),
    range('+')(() => () => [['+'], unexpectedSymbol]),
    range(',')(() => () => [[','], unexpectedSymbol]),
    range('-')(() => () => [['-'], unexpectedSymbol]),
    range('.')(() => () => [['.'], unexpectedSymbol]),
    range('/')(() => () => [['/'], unexpectedSymbol]),
    range('09')(() => a => [[fromCharCode(a)], unexpectedSymbol]),
    range(':')(() => () => [[':'], unexpectedSymbol]),
    range(';')(() => () => [[';'], unexpectedSymbol]),
    range('<')(() => () => [['<'], unexpectedSymbol]),
    range('=')(() => () => [['='], unexpectedSymbol]),
    range('>')(() => () => [['>'], unexpectedSymbol]),
    range('?')(() => () => [['?'], unexpectedSymbol]),
    range('[')(() => () => [['['], unexpectedSymbol]),
    range(']')(() => () => [[']'], unexpectedSymbol]),
    range('^')(() => () => [['^'], unexpectedSymbol]),
    range('`')(() => () => [['`'], unexpectedSymbol]),
    range('{')(() => () => [['{'], unexpectedSymbol]),
    range('|')(() => () => [['|'], unexpectedSymbol]),
    range('}')(() => () => [['}'], unexpectedSymbol]),
    range('~')(() => () => [['~'], unexpectedSymbol]),
])(undefined)
