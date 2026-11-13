/**
 * The lowering from normalized FAST to the IR: the FAST that
 * [`edag/to_fast`](../../edag/to_fast/README.md) makes, before
 * [preparation](../../js/ast/prepare/README.md) adds mutable slots, as
 * [definition.md](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
 * reads it. It takes the part of the language that the
 * [README](./README.md) lists, for [the second slice](../todo/slices.md),
 * and refuses everything else
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 *
 * - **A module is its exported functions.** Each is named by its export,
 *   and a call of another one, or of itself, is a `call` of `self`.
 * - **FAST has no types, so a table gives them**: each function's
 *   parameters and result, as a TypeScript signature names and types them.
 *   A `number` is an `f64`, a `boolean` a `bool`, and a `bigint` the range
 *   that the table gives it.
 * - **The checker types the terms** that the lowering makes, so that the
 *   operand's type picks the operator where JavaScript has one for two
 *   types: `-x` is `neg` of a float and `0n - x` of an integer, `===` of two
 *   booleans is a `match`, and `Number(x)` is `float` of an integer.
 * - **A binding is a `let`**, of a local named by how many `let`s enclose
 *   it: `#0` is the first of a function, and the arms of a `match` may each
 *   have their own.
 * - **A `return` is the body's value in the tail of a function**, and a
 *   `br` to `return` anywhere else.
 *
 * The answer is a module for the [checker](../check/module.f.mjs), which
 * refuses what the IR does not admit, such as a `match` of a float.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { BindingId, Block, Entry, Exit, Function as FastFunction, Item, Statement, Value } from '../../js/ast/types.ts'
 * @import { Fn, Module, OpName, Signature, Term, Type } from '../types.ts'
 * @import { _Meaning, _Scope } from './private.ts'
 */

import { error, ok, okList } from '../../types/result/module.f.js'
import { typeOf } from '../check/module.f.mjs'
import {
    add, bool, call, div, eq, equal, f64c, false_, float, fn, get, if_, le, let_, lit, lt, mul, n, ne, neg, not,
    return_, sub, true_,
} from '../module.f.mjs'
import { show } from '../print/module.f.mjs'

/** A count in a message: `one parameter`, `2 values`. @type {(k: number, noun: string) => string} */
const count = (k, noun) => k === 1 ? `one ${noun}` : `${k} ${noun}s`

/** @type {(t: Type) => boolean} */
const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'

/** The static functions that are operators of the IR. @type {(id: string) => OpName | null} */
const staticOp = id => id === 'Math.sqrt' ? 'sqrt' : id === 'Math.abs' ? 'abs' : null

/** @type {(scope: _Scope) => (message: string) => Result<never, string>} */
const refuse = scope => message => error(`${scope.ir.name}: ${message}`)

/** What a binding stands for, or `null` for one from outside the function. @type {(scope: _Scope, b: BindingId) => _Meaning | null} */
const meaning = (scope, b) => scope.bindings.find(([x]) => x === b)?.[1] ?? null

// blocks

/**
 * A term bound to a binding of FAST around the rest of its block: a `let`
 * of a local named by its depth.
 *
 * @type {(scope: _Scope, b: BindingId, r: Result<Term, string>, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const bind = (scope, b, r, rest) => {
    if (r[0] === 'error') { return r }
    const { ir, bindings, params } = scope
    const t = typeOf(ir)(r[1])
    if (t[0] === 'error') { return t }
    const name = `#${ir.locals.length - params}`
    const body = rest({ ir: { ...ir, locals: [...ir.locals, [name, t[1]]] }, bindings: [...bindings, [b, ['local', name]]], params })
    return body[0] === 'error' ? body : ok(let_(name, r[1], body[1]))
}

/** @type {(scope: _Scope, s: Statement, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>} */
const statement = (scope, s, rest) => {
    const no = refuse(scope)
    switch (s[0]) {
        case 'define': {
            const [, b, v, kind] = s
            if (kind === 'lazy') { return no('a lazy definition is not in this slice') }
            const op = v instanceof Array && v.length === 1 ? staticOp(v[0]) : null
            return op === null ? bind(scope, b, value(scope, v), rest) : rest({ ...scope, bindings: [...scope.bindings, [b, ['op', op]]] })
        }
        case 'block': case 'if': {
            const results = s[1]
            if (results.length !== 1) { return no(`a statement with ${count(results.length, 'result')} is not in this slice`) }
            return bind(scope, results[0], s[0] === 'block' ? block(scope, s[2], false) : choice(scope, s[2], s[3], s[4]), rest)
        }
        default: { return no('a loop is not in this slice') }
    }
}

/** @type {(scope: _Scope, exit: Exit, tail: boolean) => Result<Term, string>} */
const exitTerm = (scope, exit, tail) => {
    const no = refuse(scope)
    switch (exit[0]) {
        case 'yield': {
            const [, vs] = exit
            return vs.length === 1 ? value(scope, vs[0]) : no(`a region that yields ${count(vs.length, 'value')} is not in this slice`)
        }
        case 'return': {
            const r = value(scope, exit[2])
            return tail || r[0] === 'error' ? r : ok(return_(r[1]))
        }
        case 'throw': { return no('throw is not in this slice') }
        default: { return no('a loop is not in this slice') }
    }
}

/**
 * A block: its statements as `let`s around its exit. In the tail of a
 * function, the exit's `return` is the body's value.
 *
 * @type {(scope: _Scope, b: Block, tail: boolean) => Result<Term, string>}
 */
const block = (scope, { statements, exit }, tail) => {
    if (statements.length === 0) { return exitTerm(scope, exit, tail) }
    const [s, ...more] = statements
    return statement(scope, s, next => block(next, { statements: more, exit }, tail))
}

/** @type {(scope: _Scope, c: Value, a: Block, b: Block) => Result<Term, string>} */
const choice = (scope, c, a, b) => {
    const parts = okList([value(scope, c), block(scope, a, false), block(scope, b, false)])
    return parts[0] === 'error' ? parts : ok(if_(parts[1][0], parts[1][1], parts[1][2]))
}

// values

/** @type {(scope: _Scope, vs: readonly Value[]) => Result<readonly Term[], string>} */
const values = (scope, vs) => okList(vs.map(v => value(scope, v)))

/** An operator of two operands. @type {(scope: _Scope, f: (a: Term, b: Term) => Term, a: Value, b: Value) => Result<Term, string>} */
const binary = (scope, f, a, b) => {
    const xs = values(scope, [a, b])
    return xs[0] === 'error' ? xs : ok(f(xs[1][0], xs[1][1]))
}

/**
 * An operator of one operand, picked by the operand's type: `pick` answers
 * the term, or `null` where no operator of the slice fits.
 *
 * @type {(scope: _Scope, tag: string, x: Value, pick: (t: Type, x: Term) => Term | null) => Result<Term, string>}
 */
const unary = (scope, tag, x, pick) => {
    const r = value(scope, x)
    if (r[0] === 'error') { return r }
    const t = typeOf(scope.ir)(r[1])
    if (t[0] === 'error') { return t }
    const picked = pick(t[1], r[1])
    return picked === null ? refuse(scope)(`${tag} of ${show(t[1])} is not in this slice`) : ok(picked)
}

/**
 * `===`, or `!==` where `negated`: `eq` of two numbers, and a `match` of two
 * booleans, which evaluates each operand once on every path.
 *
 * @type {(scope: _Scope, a: Value, b: Value, negated: boolean) => Result<Term, string>}
 */
const same = (scope, a, b, negated) => {
    const xs = values(scope, [a, b])
    if (xs[0] === 'error') { return xs }
    const [x, y] = xs[1]
    const ts = okList([typeOf(scope.ir)(x), typeOf(scope.ir)(y)])
    if (ts[0] === 'error') { return ts }
    return ok(!ts[1].every(t => equal(t, bool)) ? (negated ? ne : eq)(x, y)
        : negated ? if_(x, not(y), y)
        : if_(x, y, not(y)))
}

/** @type {(item: Item<Value>) => item is readonly ['...', Value]} */
const isSpread = item => item instanceof Array && item[0] === '...'

/**
 * A call of a function of the module, or of a static function that is an
 * operator: the callee is a binding that stands for one.
 *
 * @type {(scope: _Scope, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const callTerm = (scope, callee, items) => {
    const no = refuse(scope)
    const m = callee instanceof Array && callee[0] === 'ref' ? meaning(scope, callee[1]) : null
    if (m === null || m[0] === 'local') { return no('a call of a value is not in this slice') }
    const xs = okList(items.map(item => isSpread(item) ? no('a spread argument is not in this slice') : value(scope, item)))
    if (xs[0] === 'error') { return xs }
    /** @type {Term} */
    const t = m[0] === 'function' ? call('self', m[1], xs[1]) : ['op', m[1], xs[1]]
    return ok(t)
}

/** @type {(scope: _Scope, v: Value) => Result<Term, string>} */
const value = (scope, v) => {
    const no = refuse(scope)
    if (typeof v === 'number') { return ok(lit(f64c, v)) }
    if (typeof v === 'bigint') { return ok(n(v)) }
    if (typeof v === 'boolean') { return ok(v ? true_ : false_) }
    if (!(v instanceof Array)) { return no(`${typeof v === 'string' ? 'a string' : v} is not in this slice`) }
    switch (v[0]) {
        case 'ref': {
            const m = meaning(scope, v[1])
            return m === null ? no('a binding from outside the function is not in this slice')
                : m[0] === 'local' ? ok(get(m[1]))
                : no('a function as a value is not in this slice')
        }
        case 'function': { return no('a function inside a function is not in this slice') }
        case 'block': { return block(scope, v[1], false) }
        case 'if': { return choice(scope, v[1], v[2], v[3]) }
        case '?:': {
            const parts = values(scope, [v[1], v[2], v[3]])
            return parts[0] === 'error' ? parts : ok(if_(parts[1][0], parts[1][1], parts[1][2]))
        }
        case '()': { return callTerm(scope, v[1], v[2]) }
        case '-': {
            return v.length === 3 ? binary(scope, sub, v[1], v[2])
                : unary(scope, '-', v[1], (t, x) => t[0] === 'int' ? sub(n(0n), x) : isFloat(t) ? neg(x) : null)
        }
        case '+': { return v.length === 3 ? binary(scope, add, v[1], v[2]) : no('+ of one operand is not in this slice') }
        case '!': { return unary(scope, '!', v[1], (t, x) => equal(t, bool) ? not(x) : null) }
        case 'Number': { return unary(scope, 'Number', v[1], (t, x) => t[0] === 'int' ? float(x) : isFloat(t) ? x : null) }
        case '*': { return binary(scope, mul, v[1], v[2]) }
        case '/': { return binary(scope, div, v[1], v[2]) }
        case '<': { return binary(scope, lt, v[1], v[2]) }
        case '<=': { return binary(scope, le, v[1], v[2]) }
        // Swapped: only a diverging operand could tell the order, and then the whole diverges.
        case '>': { return binary(scope, (a, b) => lt(b, a), v[1], v[2]) }
        case '>=': { return binary(scope, (a, b) => le(b, a), v[1], v[2]) }
        case '===': { return same(scope, v[1], v[2], false) }
        case '!==': { return same(scope, v[1], v[2], true) }
        default: { return no(`${v[0]} is not in this slice`) }
    }
}

// functions and modules

/**
 * A function of the module, typed by its signature: its parameters are
 * locals of the signature's names, and its `self` and its captures of the
 * module's functions are those functions.
 *
 * @type {(functions: readonly (readonly [string, Signature])[], named: readonly (readonly [BindingId, string])[]) => (entry: readonly [string, FastFunction, Signature]) => Result<readonly [string, Fn], string>}
 */
const lowerFn = (functions, named) => ([name, f, { params, result }]) => {
    /** @type {(message: string) => Result<never, string>} */
    const no = message => error(`${name}: ${message}`)
    if (f.rest !== null) { return no('a rest parameter is not in this slice') }
    if (f.parameters.length !== params.length) {
        return no(`the signature has ${count(params.length, 'parameter')}, and the function ${f.parameters.length}`)
    }
    const captured = okList(f.captures.map(({ binding, value: v }) => {
        const target = v instanceof Array && v[0] === 'ref' ? named.find(([b]) => b === v[1]) : undefined
        return target === undefined ? no('a capture that is not a function of the module is not in this slice')
            : ok(/** @type {const} */ ([binding, ['function', target[1]]]))
    }))
    if (captured[0] === 'error') { return captured }
    /** @type {readonly (readonly [BindingId, _Meaning])[]} */
    const bindings = [
        ...f.parameters.map((b, k) => /** @type {const} */ ([b, ['local', params[k][0]]])),
        ...(f.self === null ? [] : [/** @type {const} */ ([f.self, ['function', name]])]),
        ...captured[1],
    ]
    const body = block({ ir: { name, locals: params, result, functions }, bindings, params: params.length }, f.body, true)
    return body[0] === 'error' ? body : ok([name, fn(params, result, body[1])])
}

/** A function that the module defines, from one of its statements. @type {(s: Statement) => Result<readonly [BindingId, FastFunction], string>} */
const defined = s =>
    s[0] !== 'define' ? error(`a module statement of the kind ${s[0]} is not in this slice`)
    : s[3] === 'lazy' ? error('a lazy definition is not in this slice')
    : s[2] instanceof Array && s[2][0] === 'function' ? ok([s[1], s[2][1]])
    : error('a module constant is not in this slice')

/**
 * The lowering of a module: the normalized FAST of its text, and the
 * signatures of its exports, by their names. The functions keep the order
 * of the exports.
 *
 * @type {(signatures: Readonly<Record<string, Signature>>) => (fast: Block) => Result<Module, string>}
 */
export const lower = signatures => ({ statements, exit }) => {
    const table = Object.entries(signatures)
    const definitions = okList(statements.map(defined))
    if (definitions[0] === 'error') { return definitions }
    const exports = exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : null
    if (!(exports instanceof Array) || exports[0] !== 'object') { return error('a module that yields no object of exports is not in this slice') }
    /** @type {(entry: Entry<Value>) => Result<readonly [string, FastFunction, BindingId | null], string>} */
    const entry = entry => {
        if (entry[0] === '...' || typeof entry[1] !== 'string') { return error('an export of a computed name is not in this slice') }
        const [, key, v] = entry
        const found = v instanceof Array && v[0] === 'ref' ? definitions[1].find(([b]) => b === v[1]) : undefined
        return v instanceof Array && v[0] === 'function' ? ok(/** @type {const} */ ([key, v[1], null]))
            : found !== undefined ? ok(/** @type {const} */ ([key, found[1], found[0]]))
            : error(`${key}: an export that is not a function is not in this slice`)
    }
    const entries = okList(exports[1].map(entry))
    if (entries[0] === 'error') { return entries }
    const all = entries[1]
    const shared = all.find(([, , b], k) => b !== null && all.findIndex(([, , x]) => x === b) !== k)
    if (shared !== undefined) {
        return error(`${shared[0]} exports the same function as ${all.find(([, , b]) => b === shared[2])?.[0]}`)
    }
    if (definitions[1].some(([b]) => !all.some(([, , x]) => x === b))) {
        return error('a function that the module does not export is not in this slice')
    }
    const stray = table.find(([k]) => !all.some(([key]) => key === k))
    if (stray !== undefined) { return error(`${stray[0]} has a signature, and the module exports no function ${stray[0]}`) }
    const typed = okList(all.map(([key, f]) => {
        const s = table.find(([k]) => k === key)
        return s === undefined ? error(`${key} has no signature`) : ok(/** @type {const} */ ([key, f, s[1]]))
    }))
    if (typed[0] === 'error') { return typed }
    const named = all.flatMap(([key, , b]) => b === null ? [] : [/** @type {const} */ ([b, key])])
    const functions = okList(typed[1].map(lowerFn(table, named)))
    return functions[0] === 'error' ? functions : ok({ functions: functions[1], exports: all.map(([key]) => key) })
}
