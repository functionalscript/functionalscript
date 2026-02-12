import { strictEqual } from '../types/function/operator/module.f.ts'
import {
    merge as rangeMapMerge,
    fromRange,
    get,
    type RangeMapArray,
    type RangeMerge,
} from '../types/range_map/module.f.ts'
import { reduce as listReduce, toArray, map, type List } from '../types/list/module.f.ts'
import { range as asciiRange } from '../text/ascii/module.f.ts'
import { fn } from '../types/function/module.f.ts'
import { one, type Range } from '../types/range/module.f.ts'

const fromCharCode = String.fromCharCode

type Result = readonly[readonly string[], ToResult]

type ToResult = (codePoint: number) => Result

type CreateToResult<T> = (state: T) => ToResult

type State<T> = RangeMapArray<CreateToResult<T>>

const unexpectedSymbol: ToResult
    = codePoint => [[`unexpected symbol ${codePoint}`], unexpectedSymbol]

const def: <T>(state: T) => ToResult
    = () => unexpectedSymbol

const union = <T>(a: CreateToResult<T>) => (b: CreateToResult<T>): CreateToResult<T> => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

const empty: readonly never[] = []

const reduce = <T>(a: List<State<T>>): State<T> => {
    const merge: RangeMerge<CreateToResult<T>>
        = rangeMapMerge({
            union,
            equal: strictEqual,
            def,
        })
    return toArray(listReduce(merge)(empty)(a))
}

const codePointRange = fromRange(def)

const range = fn(asciiRange).map(codePointRange).result

const rangeSet = (l: readonly string[]) => <T>(f: CreateToResult<T>): State<T> => {

    const codePointRange: (a: Range) => (f: CreateToResult<T>) => State<T>
        = fromRange(def)

    const g: (r: string) => State<T>
        = r => codePointRange(asciiRange(r))(f)

    return reduce(map(g)(l))
}

const create = <T>(a: List<State<T>>): CreateToResult<T> => {
    const i = reduce(a)
    const x: (v: number) => (i: State<T>) => (v: T) => ToResult
        = get(def)
    return v => c => x(c)(i)(v)(c)
}

export const terminal = -1

const toInit: () => ToResult
    = () => () => [[], init]

export const init: ToResult = create([
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
