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
 * - **A module is the exported functions that a table names**, each by its
 *   export, and a call of another one, or of itself, is a `call` of `self`.
 *   The lowering reads the module's functions, not its evaluation: nothing
 *   else of the module is read unless a function that it lowers reads it.
 * - **FAST has no types, so the table gives them**: each function's
 *   parameters and result, as a TypeScript signature names and types them.
 *   A `number` is an `f64`, a `boolean` a `bool`, a `bigint` the range that
 *   the table gives it, and a value of unknown kind `any`.
 * - **An import of the L0 view is L0.** The caller names the view's
 *   specifier, and the module then imports
 *   [the interfaces of L0](../l0/module.f.js). JavaScript reads a tag and a
 *   length as numbers, so each is a float here: `kind(v)` is
 *   `float(Any.kind(v))`, and a tag such as `BOOLEAN` is its float.
 *   `asBoolean` and `asNumber` are casts to `to_bool` and `to_f64`, and
 *   `length(v)` is a `match` of `v`'s kinds, an arm for each module of L0
 *   that has a `length`, and a trap for the kinds that none takes. Any other
 *   import is refused.
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
 * @import { AstImport } from '../../compiler/ast/types.ts'
 * @import { BindingId, Block, Entry, Exit, Function as FastFunction, Item, Statement, Value } from '../../js/ast/types.ts'
 * @import { Fn, Module, OpName, Signature, Term, Type } from '../types.ts'
 * @import { _Global, _Meaning, _Scope } from './private.ts'
 */

import { error, ok, okList } from '../../types/result/module.f.js'
import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED } from '../../wasm/runtime/l0/module.f.js'
import { typeOf } from '../check/module.f.mjs'
import { any, kinds, l0, lengths } from '../l0/module.f.js'
import {
    add, bool, call, cast, div, eq, equal, f64c, false_, float, fn, get, if_, le, let_, lit, lt, match, mul, n, ne,
    neg, not, only, return_, sub, trap, true_,
} from '../module.f.js'
import { show } from '../print/module.f.js'

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

// the L0 view

/** The L0 view's constants, the tags of the kinds of `any`, which JavaScript reads as numbers. @type {readonly (readonly [string, number])[]} */
const constants = [
    ['UNDEFINED', UNDEFINED], ['NULL', NULL], ['BOOLEAN', BOOLEAN], ['NUMBER', NUMBER], ['STRING', STRING],
    ['BIGINT', BIGINT], ['ARRAY', ARRAY], ['OBJECT', OBJECT], ['FUNCTION', FUNCTION],
]

/**
 * `length(x)`: an arm for each module of L0 whose `length` takes some of
 * `x`'s kinds, naming `x` at those kinds, and a trap for the kinds that no
 * `length` takes. JavaScript reads a length as a number.
 *
 * @type {(x: Term, held: readonly string[], base: string) => Term}
 */
const lengthOf = (x, held, base) => {
    const named = lengths.flatMap(([, , ks]) => ks)
    /** @type {readonly (readonly [readonly string[], string | null, Term])[]} */
    const arms = [
        ...lengths.map(([module, , ks]) => {
            const binder = `${base}.${module.toLowerCase()}`
            return /** @type {const} */ ([ks.filter(k => held.includes(k)), binder, call(module, 'length', [get(binder)])])
        }),
        [held.filter(k => !named.includes(k)), null, trap('no length')],
    ]
    return float(match(x, arms.filter(([vs]) => vs.length > 0)))
}

/**
 * A call of a function of the L0 view, on one value of `any`: `kind`, a
 * cast, or `length`. A name for the operand of an arm that the call makes is
 * the operand's, or the function's, and the kinds there: `v.number`.
 *
 * @type {(scope: _Scope, name: string, args: readonly Term[]) => Result<Term, string>}
 */
const viewCall = (scope, name, args) => {
    const no = refuse(scope)
    if (!['kind', 'asBoolean', 'asNumber', 'length'].includes(name)) { return no(`${name} of L0 is not in this slice`) }
    if (args.length !== 1) { return no(`${name} takes one argument, not ${args.length}`) }
    const [x] = args
    const t = typeOf(scope.ir)(x)
    if (t[0] === 'error') { return t }
    const type = t[1]
    if (type[0] !== 'sealed') { return no(`${name} of ${show(type)} is not in this slice`) }
    const base = x[0] === 'get' ? x[1] : name
    switch (name) {
        case 'kind': { return ok(float(call('Any', 'kind', [x]))) }
        case 'asBoolean': { return ok(cast(only(any, 'boolean'), x, `${base}.boolean`, y => call('Any', 'to_bool', [y]))) }
        case 'asNumber': { return ok(cast(only(any, 'number'), x, `${base}.number`, y => call('Any', 'to_f64', [y]))) }
        default: { return ok(lengthOf(x, type[3] ?? kinds, base)) }
    }
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
 * A call of a function of the module, of a static function that is an
 * operator, or of a function of the L0 view: the callee is a binding that
 * stands for one.
 *
 * @type {(scope: _Scope, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const callTerm = (scope, callee, items) => {
    const no = refuse(scope)
    const m = callee instanceof Array && callee[0] === 'ref' ? meaning(scope, callee[1]) : null
    if (m === null || m[0] === 'local') { return no('a call of a value is not in this slice') }
    const xs = okList(items.map(item => isSpread(item) ? no('a spread argument is not in this slice') : value(scope, item)))
    if (xs[0] === 'error') { return xs }
    if (m[0] === 'l0') { return viewCall(scope, m[1], xs[1]) }
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
            const tag = m !== null && m[0] === 'l0' ? constants.find(([k]) => k === m[1]) : undefined
            return m === null ? no('a binding from outside the function is not in this slice')
                : m[0] === 'local' ? ok(get(m[1]))
                : tag !== undefined ? ok(lit(f64c, tag[1]))
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
 * locals of the signature's names, and its `self` and its captures are what
 * `capture` makes of the module's bindings.
 *
 * @type {(ir: { readonly functions: readonly (readonly [string, Signature])[], readonly imports: Module['imports'] }, capture: (b: BindingId) => Result<_Meaning, string>) => (entry: readonly [string, FastFunction, Signature]) => Result<readonly [string, Fn], string>}
 */
const lowerFn = ({ functions, imports }, capture) => ([name, f, { params, result }]) => {
    /** @type {(message: string) => Result<never, string>} */
    const no = message => error(`${name}: ${message}`)
    if (f.rest !== null) { return no('a rest parameter is not in this slice') }
    if (f.parameters.length !== params.length) {
        return no(`the signature has ${count(params.length, 'parameter')}, and the function ${f.parameters.length}`)
    }
    const captured = okList(f.captures.map(({ binding, value: v }) => {
        const m = v instanceof Array && v[0] === 'ref' ? capture(v[1]) : error('a capture that is not a function of the module is not in this slice')
        return m[0] === 'error' ? no(m[1]) : ok(/** @type {const} */ ([binding, m[1]]))
    }))
    if (captured[0] === 'error') { return captured }
    /** @type {readonly (readonly [BindingId, _Meaning])[]} */
    const bindings = [
        ...f.parameters.map((b, k) => /** @type {const} */ ([b, ['local', params[k][0]]])),
        ...(f.self === null ? [] : [/** @type {const} */ ([f.self, ['function', name]])]),
        ...captured[1],
    ]
    const body = block({ ir: { name, locals: params, result, functions, imports }, bindings, params: params.length }, f.body, true)
    return body[0] === 'error' ? body : ok([name, fn(params, result, body[1])])
}

/**
 * Import `i`'s export `name`, as FAST reads it from the arguments of the
 * module: `['.', ['.', ['ref', args], i], name]`, where `args` is the
 * module's one free binding or a definition of it. An export of the L0 view
 * is its name; any other import is refused. `null` where `v` reads no
 * import.
 *
 * @type {(view: string | null, imports: readonly AstImport[], args: (b: BindingId) => boolean, v: Value) => _Global | null}
 */
const imported = (view, imports, args, v) => {
    if (!(v instanceof Array) || v[0] !== '.' || v.length !== 3 || typeof v[2] !== 'string') { return null }
    const slot = v[1]
    if (!(slot instanceof Array) || slot[0] !== '.' || slot.length !== 3 || typeof slot[2] !== 'number') { return null }
    const from = slot[1]
    if (!(from instanceof Array) || from[0] !== 'ref' || !args(from[1])) { return null }
    const m = imports[slot[2]]
    return m === undefined ? ['refused', `no import ${slot[2]}`]
        : m.specifier === view && !m.json ? ['l0', v[2]]
        : ['refused', `an import of ${m.specifier} is not in this slice`]
}

/**
 * What each binding that the module's statements define stands for. A
 * binding that no statement defines holds the module's imports, and so
 * does a definition that only names it; a definition that reads an import
 * from one of them is that import.
 *
 * @type {(view: string | null, imports: readonly AstImport[], statements: readonly Statement[]) => readonly (readonly [BindingId, _Global])[]}
 */
const globals = (view, imports, statements) => {
    /** @type {(s: Statement) => readonly BindingId[]} */
    const results = s => s[0] === 'define' ? [s[1]] : s[0] === 'loop' ? s[1].results : s[1]
    const defined = statements.flatMap(results)
    const aliases = statements.flatMap(s => s[0] === 'define' && s[2] instanceof Array && s[2][0] === 'ref' && !defined.includes(s[2][1]) ? [s[1]] : [])
    /** @type {(b: BindingId) => boolean} */
    const args = b => aliases.includes(b) || !defined.includes(b)
    return statements.flatMap(s => {
        /** @type {_Global} */
        const g = s[0] !== 'define' ? ['refused', `a module statement of the kind ${s[0]} is not in this slice`]
            : s[3] === 'lazy' ? ['refused', 'a lazy definition is not in this slice']
            : s[2] instanceof Array && s[2][0] === 'function' ? ['function', s[2][1]]
            : aliases.includes(s[1]) ? ['args']
            : imported(view, imports, args, s[2]) ?? ['refused', 'a module constant is not in this slice']
        return results(s).map(b => /** @type {const} */ ([b, g]))
    })
}

/**
 * An export's value past the blocks that the normalization puts around it,
 * where only the export reads a binding, and the statements of those
 * blocks, which define bindings of the module.
 *
 * @type {(v: Value) => readonly [readonly Statement[], Value]}
 */
const unwrapped = v => {
    if (!(v instanceof Array) || v[0] !== 'block') { return [[], v] }
    const { statements, exit } = v[1]
    if (exit[0] !== 'yield' || exit[1].length !== 1) { return [[], v] }
    const [inner, w] = unwrapped(exit[1][0])
    return [[...statements, ...inner], w]
}

/**
 * The lowering of a module: the signatures of the exported functions to
 * lower, by their names, and the specifier of the L0 view, where the module
 * imports it; then the normalized FAST of the module's text and its
 * imports. The functions keep the order of the exports.
 *
 * @type {(signatures: Readonly<Record<string, Signature>>, view?: string | null) => (fast: Block, imports?: readonly AstImport[]) => Result<Module, string>}
 */
export const lower = (signatures, view = null) => ({ statements, exit }, imports = []) => {
    const table = Object.entries(signatures)
    const exports = exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : null
    if (!(exports instanceof Array) || exports[0] !== 'object') { return error('a module that yields no object of exports is not in this slice') }
    /** @type {(entry: Entry<Value>) => Result<readonly [string, readonly Statement[], Value], string>} */
    const entry = entry => entry[0] === '...' || typeof entry[1] !== 'string' ? error('an export of a computed name is not in this slice') : ok([entry[1], ...unwrapped(entry[2])])
    const entries = okList(exports[1].map(entry))
    if (entries[0] === 'error') { return entries }
    const all = entries[1].map(([key, , v]) => /** @type {const} */ ([key, v]))
    const stray = table.find(([k]) => !all.some(([key]) => key === k))
    if (stray !== undefined) { return error(`${stray[0]} has a signature, and the module exports no function ${stray[0]}`) }
    const defined = globals(view, imports, [...statements, ...entries[1].flatMap(([, ss]) => ss)])
    /** @type {(b: BindingId) => _Global | undefined} */
    const globalOf = b => defined.find(([x]) => x === b)?.[1]
    /** An export that the table names, as the function to lower and the binding that defines it, if one does. @type {(key: string, v: Value, s: Signature) => Result<readonly [string, FastFunction, Signature, BindingId | null], string>} */
    const choose = (key, v, s) => {
        if (v instanceof Array && v[0] === 'function') { return ok([key, v[1], s, null]) }
        const b = v instanceof Array && v[0] === 'ref' ? v[1] : null
        const g = b === null ? undefined : globalOf(b)
        return b !== null && g !== undefined && g[0] === 'function' ? ok([key, g[1], s, b])
            : g !== undefined && g[0] === 'refused' ? error(`${key}: ${g[1]}`)
            : error(`${key}: an export that is not a function is not in this slice`)
    }
    const chosen = okList(all.flatMap(([key, v]) => {
        const s = table.find(([k]) => k === key)
        return s === undefined ? [] : [choose(key, v, s[1])]
    }))
    if (chosen[0] === 'error') { return chosen }
    const lowered = chosen[1]
    const shared = lowered.find(([, , , b], k) => b !== null && lowered.findIndex(([, , , x]) => x === b) !== k)
    if (shared !== undefined) {
        return error(`${shared[0]} exports the same function as ${lowered.find(([, , , b]) => b === shared[3])?.[0]}`)
    }
    /** What a function that the lowering makes reads where it captures `b`. @type {(b: BindingId) => Result<_Meaning, string>} */
    const capture = b => {
        const own = lowered.find(([, , , x]) => x === b)
        const g = globalOf(b)
        const exported = all.find(([, v]) => v instanceof Array && v[0] === 'ref' && v[1] === b)
        return own !== undefined ? ok(['function', own[0]])
            : g === undefined || g[0] === 'args' ? error('a capture that is not a function of the module is not in this slice')
            : g[0] === 'l0' ? ok(g)
            : g[0] === 'refused' ? error(g[1])
            : exported !== undefined ? error(`${exported[0]} has no signature`)
            : error('a function that the module does not export is not in this slice')
    }
    const ir = { functions: table, imports: view === null ? [] : l0 }
    const functions = okList(lowered.map(([key, f, s]) => lowerFn(ir, capture)([key, f, s])))
    return functions[0] === 'error' ? functions : ok({ imports: ir.imports, functions: functions[1], exports: lowered.map(([key]) => key) })
}
