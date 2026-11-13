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
 *   `asBoolean`, `asNumber` and `asString` are casts, to `to_bool`,
 *   `to_f64` and the string itself, and `length(v)` is a `match` of `v`'s
 *   kinds, an arm for each module of L0 that has a `length`, and a trap for
 *   the kinds that none takes, or a call where one module takes them all.
 *   `unit(s, i)` reads the integer that the float `i` holds exactly, and
 *   traps where it holds none. Any other import is refused.
 * - **The checker types the terms** that the lowering makes, so that the
 *   operand's type picks the operator where JavaScript has one for two
 *   types: `-x` is `neg` of a float and `0n - x` of an integer, `===` of two
 *   booleans is a `match`, and `Number(x)` is `float` of an integer.
 * - **A binding is a `let`**, of a local named by how many locals of FAST
 *   enclose it: `#0` is the first of a function, and the arms of a `match`
 *   may each have their own. A binding of a local is that local, and a
 *   `let` whose body is only its local is its value.
 * - **A `return` is the body's value in the tail of a function**, and a
 *   `br` to `return` anywhere else.
 * - **A statement that never completes ends its block**: a block or an `if`
 *   whose every path ends in a transfer stands where the block's end
 *   would, and what follows it is never reached.
 * - **A loop is a `loop`**, labelled by how many loops enclose it, `L0`.
 *   Its parameters are locals of the types of their first values, a float
 *   widened to `f64`. `continue` is a `br` to it, and `break` is its value
 *   where it ends the loop's body.
 * - **A function inside a function is inlined where it is called.**
 *   Normalized FAST makes a function of each loop and calls it once. Its
 *   parameters stand for the arguments, a local or a literal as itself and
 *   anything else bound to a local, its captures for what they read where
 *   the call stands, and the `return` that ends its body for its value.
 * - **A cast narrows the rest of its block**
 *   ([definition.md, rule 4](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)).
 *   Where the first thing that a definition's value does is a cast of a
 *   local, `asString(a)` say, a `cast` of the local wraps the definition and
 *   the rest of the block, which read it at the cast's kind: `a.string`.
 *
 * The answer is a module for the [checker](../check/module.f.mjs), which
 * refuses what the IR does not admit, such as a `match` of a float.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstImport } from '../../compiler/ast/types.ts'
 * @import { BindingId, Block, Entry, Exit, Function as FastFunction, Item, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { Fn, LoopParamOf, Module, OpName, Signature, Term, Type } from '../types.ts'
 * @import { _Global, _Meaning, _Scope, _Tail } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { error, ok, okList } from '../../types/result/module.f.js'
import { ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED } from '../../wasm/runtime/l0/module.f.js'
import { typeOf } from '../check/module.f.mjs'
import { any, kinds, l0, lengths } from '../l0/module.f.js'
import {
    add, bool, call, cast, div, eq, equal, exact, f64, f64c, false_, float, fn, get, if_, le, let_, lit, loop, lt,
    match, mul, n, ne, neg, next, not, only, return_, sub, trap, true_, u,
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

/** The scope where `b` stands for `m`. @type {(scope: _Scope, b: BindingId, m: _Meaning) => _Scope} */
const standsFor = (scope, b, m) => ({ ...scope, bindings: [...scope.bindings, [b, m]] })

/** A term that does nothing but give its value: a local, a literal, or `false` or `true`. @type {(t: Term) => boolean} */
const isPure = t => t[0] === 'get' || t[0] === 'lit' || equal(t, false_) || equal(t, true_)

// blocks

/**
 * A term in a `let` of a local named by its depth, around the rest of its
 * block, which reads the local by that name. A `let` whose body is only its
 * local is its value.
 *
 * @type {(scope: _Scope, x: Term, rest: (scope: _Scope, name: string) => Result<Term, string>) => Result<Term, string>}
 */
const bindTerm = (scope, x, rest) => {
    const { ir, depth } = scope
    const t = typeOf(ir)(x)
    if (t[0] === 'error') { return t }
    const name = `#${depth}`
    const body = rest({ ...scope, ir: { ...ir, locals: [...ir.locals, [name, t[1]]] }, depth: depth + 1 }, name)
    if (body[0] === 'error') { return body }
    const [, b] = body
    return ok(b[0] === 'get' && b[1] === name ? x : let_(name, x, b))
}

/**
 * A term bound to a binding of FAST around the rest of its block: a `let`,
 * or the local itself where the term is a local.
 *
 * @type {(scope: _Scope, b: BindingId, r: Result<Term, string>, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const bind = (scope, b, r, rest) => {
    if (r[0] === 'error') { return r }
    const [, x] = r
    return x[0] === 'get' ? rest(standsFor(scope, b, ['local', x[1]]))
        : bindTerm(scope, x, (next, name) => rest(standsFor(next, b, ['local', name])))
}

/**
 * Whether the end of a block may be reached, and so what follows it: not
 * where it ends in a transfer, nor where one of its statements never
 * completes, a block that never does or an `if` whose arms both never do.
 *
 * @type {(b: Block) => boolean}
 */
const completes = ({ statements, exit }) => exit[0] === 'yield' && statements.every(s =>
    s[0] === 'block' ? completes(s[2]) : s[0] === 'if' ? completes(s[3]) || completes(s[4]) : true)

/** @type {(scope: _Scope, s: Statement, tail: _Tail, rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>} */
const statement = (scope, s, tail, rest) => {
    const no = refuse(scope)
    switch (s[0]) {
        case 'define': {
            const [, b, v, kind] = s
            if (kind === 'lazy') { return no('a lazy definition is not in this slice') }
            if (v instanceof Array && v[0] === 'function') { return rest(standsFor(scope, b, ['inline', v[1]])) }
            const op = v instanceof Array && v.length === 1 ? staticOp(v[0]) : null
            if (op !== null) { return rest(standsFor(scope, b, ['op', op])) }
            const c = firstCast(scope, v)
            return c instanceof Array ? narrow(scope, c, next => statement(next, s, tail, rest)) : bind(scope, b, value(scope, v), rest)
        }
        case 'block': {
            const [, results, b] = s
            // A block that never completes ends its block, and what follows it is never reached.
            if (!completes(b)) { return block(scope, b, tail) }
            return results.length !== 1 ? no(`a statement with ${count(results.length, 'result')} is not in this slice`)
                : bind(scope, results[0], block(scope, b, ['value']), rest)
        }
        case 'if': {
            const [, results, c, a, b] = s
            if (!completes(a) && !completes(b)) { return choice(scope, c, a, b, tail) }
            return results.length !== 1 ? no(`a statement with ${count(results.length, 'result')} is not in this slice`)
                : bind(scope, results[0], choice(scope, c, a, b, ['value']), rest)
        }
        default: {
            const [, l] = s
            return l.results.length !== 1 ? no(`a loop with ${count(l.results.length, 'result')} is not in this slice`)
                : bind(scope, l.results[0], loopTerm(scope, l), rest)
        }
    }
}

/**
 * The exit of a block where its end stands: a `yield` is the block's value,
 * a `return` and a `break` are where they end a function's or a loop's
 * body, and a `continue` is a `br` to its loop anywhere in the loop's body.
 *
 * @type {(scope: _Scope, exit: Exit, tail: _Tail) => Result<Term, string>}
 */
const exitTerm = (scope, exit, tail) => {
    const no = refuse(scope)
    switch (exit[0]) {
        case 'yield': {
            const [, vs] = exit
            return tail[0] === 'loop' ? no("a loop's body that ends in neither continue nor break is not in this slice")
                : vs.length === 1 ? value(scope, vs[0])
                : no(`a region that yields ${count(vs.length, 'value')} is not in this slice`)
        }
        case 'return': {
            if (tail[0] === 'loop') { return no('a return inside a loop is not in this slice') }
            const r = value(scope, exit[2])
            return tail[0] === 'return' || r[0] === 'error' ? r
                : scope.inlined ? no('a return before the end of a function inside a function is not in this slice')
                : ok(return_(r[1]))
        }
        case 'continue': {
            const [, target, vs] = exit
            // A continue stands in the body of its loop, in the same function.
            const [, label, params] = assertNotNullish(scope.loops.find(([t]) => t === target))
            const xs = values(scope, vs)
            return xs[0] === 'error' ? xs : ok(next(label, params.map((k, j) => /** @type {const} */ ([k, xs[1][j]]))))
        }
        case 'break': {
            const [, target, vs] = exit
            return tail[0] === 'loop' && tail[1] === target ? value(scope, vs[0])
                : no("a break before the end of its loop's body is not in this slice")
        }
        case 'throw': { return no('throw is not in this slice') }
        default: { return no('a loop that never breaks is not in this slice') }
    }
}

/**
 * A block: its statements as `let`s around its exit, which ends where
 * `tail` says.
 *
 * @type {(scope: _Scope, b: Block, tail: _Tail) => Result<Term, string>}
 */
const block = (scope, { statements, exit }, tail) => {
    if (statements.length === 0) { return exitTerm(scope, exit, tail) }
    const [s, ...more] = statements
    return statement(scope, s, tail, next => block(next, { statements: more, exit }, tail))
}

/** @type {(scope: _Scope, c: Value, a: Block, b: Block, tail: _Tail) => Result<Term, string>} */
const choice = (scope, c, a, b, tail) => {
    const parts = okList([value(scope, c), block(scope, a, tail), block(scope, b, tail)])
    return parts[0] === 'error' ? parts : ok(if_(parts[1][0], parts[1][1], parts[1][2]))
}

// loops and inlined functions

/**
 * A loop: its parameters are locals named by their depth, of the types of
 * their first values, a float widened to `f64`, since a later round may
 * give any float. An integer range is refused, since no bound holds what a
 * later round may give it. The body ends where the loop's `break` is the
 * loop's value.
 *
 * @type {(scope: _Scope, l: Loop) => Result<Term, string>}
 */
const loopTerm = (scope, { target, parameters, initial, body }) => {
    const firsts = values(scope, initial)
    if (firsts[0] === 'error') { return firsts }
    const types = okList(firsts[1].map(x => typeOf(scope.ir)(x)))
    if (types[0] === 'error') { return types }
    const wide = types[1].map(t => isFloat(t) ? f64 : t)
    const range = wide.find(t => t[0] === 'int')
    if (range !== undefined) { return refuse(scope)(`a loop parameter of ${show(range)} is not in this slice`) }
    const { ir, bindings, depth, loops } = scope
    const label = `L${loops.length}`
    /** @type {readonly LoopParamOf<Term>[]} */
    const params = firsts[1].map((x, j) => [`#${depth + j}`, wide[j], x])
    const names = params.map(([k]) => k)
    /** @type {_Scope} */
    const inner = {
        ...scope,
        ir: { ...ir, locals: [...ir.locals, ...params.map(([k, t]) => /** @type {const} */ ([k, t]))] },
        bindings: [...bindings, ...parameters.map((b, j) => /** @type {const} */ ([b, ['local', names[j]]]))],
        depth: depth + params.length,
        loops: [[target, label, names], ...loops],
    }
    const b = block(inner, body, ['loop', target])
    return b[0] === 'error' ? b : ok(loop(label, params, b[1]))
}

/**
 * A call of a function that the function defines: its body, inlined where
 * the call stands, which ends where its `return` is its value. Its
 * parameters stand for the arguments, a term that does nothing as itself,
 * and anything else bound to a local first, in their order; its captures
 * stand for what they read where the call stands.
 *
 * @type {(scope: _Scope, f: FastFunction, args: readonly Term[]) => Result<Term, string>}
 */
const inline = (scope, f, args) => {
    const no = refuse(scope)
    if (f.rest !== null) { return no('a rest parameter is not in this slice') }
    if (f.self !== null) { return no('a function inside a function that names itself is not in this slice') }
    if (f.parameters.length !== args.length) {
        return no(`a function inside a function takes ${count(f.parameters.length, 'argument')}, and its call gives ${args.length}`)
    }
    const captured = okList(f.captures.map(({ binding, value: v }) => {
        const m = v instanceof Array && v[0] === 'ref' ? meaning(scope, v[1]) : null
        return m === null ? no('a capture that is no binding of the function is not in this slice') : ok(/** @type {const} */ ([binding, m]))
    }))
    if (captured[0] === 'error') { return captured }
    /** The parameters from the `j`-th on, standing for their arguments, around the body. @type {(s: _Scope, j: number) => Result<Term, string>} */
    const from = (s, j) => {
        if (j === args.length) { return block(s, f.body, ['return']) }
        const b = f.parameters[j]
        const x = args[j]
        return x[0] === 'get' ? from(standsFor(s, b, ['local', x[1]]), j + 1)
            : isPure(x) ? from(standsFor(s, b, ['term', x]), j + 1)
            : bindTerm(s, x, (t, name) => from(standsFor(t, b, ['local', name]), j + 1))
    }
    return from({ ...scope, bindings: [...scope.bindings, ...captured[1]], inlined: true }, 0)
}

// casts

/** The casts of the L0 view, each with the kind that it narrows to. @type {readonly (readonly [string, string])[]} */
const casts = [['asBoolean', 'boolean'], ['asNumber', 'number'], ['asString', 'string']]

/**
 * The cast that a value does first, as the local that it narrows and the
 * kind: a cast of the L0 view of a local that holds other kinds too, where
 * it is the first thing that the value does. A reference and a primitive
 * do `'nothing'`, and a call does what its arguments do, in their order,
 * then itself. `null` where the value does something else first, which a
 * call of anything but such a cast is, and so is anything else.
 *
 * @type {(scope: _Scope, v: Item<Value>) => readonly [string, string] | 'nothing' | null}
 */
const firstCast = (scope, v) => {
    if (!(v instanceof Array) || v[0] === 'ref') { return 'nothing' }
    if (v[0] !== '()') { return null }
    const [, callee, items] = v
    const m = callee instanceof Array && callee[0] === 'ref' ? meaning(scope, callee[1]) : null
    const c = m !== null && m[0] === 'l0' ? casts.find(([k]) => k === m[1]) : undefined
    const [x] = items
    const local = items.length === 1 && x instanceof Array && x[0] === 'ref' ? meaning(scope, x[1]) : null
    if (c !== undefined && local !== null && local[0] === 'local' && wider(scope, local[1], c[1])) { return [local[1], c[1]] }
    const first = firstOf(scope, items)
    return first === 'nothing' ? null : first
}

/** The cast that values do first, in their order. @type {(scope: _Scope, vs: readonly Item<Value>[]) => readonly [string, string] | 'nothing' | null} */
const firstOf = (scope, vs) => {
    if (vs.length === 0) { return 'nothing' }
    const [v, ...more] = vs
    const first = firstCast(scope, v)
    return first === 'nothing' ? firstOf(scope, more) : first
}

/** Whether a local holds a value of a sealed type that has kinds besides `kind`. @type {(scope: _Scope, name: string, kind: string) => boolean} */
const wider = (scope, name, kind) => {
    const [, t] = assertNotNullish(scope.ir.locals.find(([k]) => k === name))
    return t[0] === 'sealed' && !(t[3] ?? kinds).every(k => k === kind)
}

/**
 * The rest of a block where a cast narrows a local: a `cast` of the local
 * to the kind, its arm named after the local and the kind, `a.string`,
 * which every binding that read the local reads from then on.
 *
 * @type {(scope: _Scope, c: readonly [string, string], rest: (scope: _Scope) => Result<Term, string>) => Result<Term, string>}
 */
const narrow = (scope, [name, kind], rest) => {
    const binder = `${name}.${kind}`
    const t = only(any, kind)
    const { ir, bindings } = scope
    const body = rest({
        ...scope,
        ir: { ...ir, locals: [...ir.locals, [binder, t]] },
        bindings: bindings.map(([b, m]) => m[0] === 'local' && m[1] === name ? /** @type {const} */ ([b, ['local', binder]]) : [b, m]),
    })
    return body[0] === 'error' ? body : ok(cast(t, get(name), binder, body[1]))
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
 * `length` takes, or a call of the one module that takes them all.
 * JavaScript reads a length as a number.
 *
 * @type {(x: Term, held: readonly string[], base: string) => Term}
 */
const lengthOf = (x, held, base) => {
    const named = lengths.flatMap(([, , ks]) => ks)
    const parts = lengths.map(([module, , ks]) => /** @type {const} */ ([module, ks.filter(k => held.includes(k))])).filter(([, ks]) => ks.length > 0)
    const others = held.filter(k => !named.includes(k))
    if (parts.length === 1 && others.length === 0) { return float(call(parts[0][0], 'length', [x])) }
    /** @type {readonly (readonly [readonly string[], string | null, Term])[]} */
    const arms = [
        ...parts.map(([module, ks]) => {
            const binder = `${base}.${module.toLowerCase()}`
            return /** @type {const} */ ([ks, binder, call(module, 'length', [get(binder)])])
        }),
        [others, null, trap('no length')],
    ]
    return float(match(x, arms.filter(([vs]) => vs.length > 0)))
}

/** The functions of the L0 view that the lowering reads, beside its tags. */
const viewFunctions = ['kind', 'asBoolean', 'asNumber', 'asString', 'length', 'unit']

/**
 * A call of a function of the L0 view, whose first argument is a value of
 * `any`: `kind`, a cast, `length`, or `unit`. A cast of a value that holds
 * no other kind is the value. A name for the operand of an arm that the
 * call makes is the operand's, or the function's, and the kinds there:
 * `v.number`. So the only term in an arm is a local or a literal: `unit`'s
 * index, where it does something, is a local bound before the cast.
 *
 * @type {(scope: _Scope, name: string, args: readonly Term[]) => Result<Term, string>}
 */
const viewCall = (scope, name, args) => {
    const no = refuse(scope)
    if (!viewFunctions.includes(name)) { return no(`${name} of L0 is not in this slice`) }
    const arity = name === 'unit' ? 2 : 1
    if (args.length !== arity) { return no(`${name} takes ${count(arity, 'argument')}, not ${args.length}`) }
    const types = okList(args.map(x => typeOf(scope.ir)(x)))
    if (types[0] === 'error') { return types }
    const [x, i] = args
    const [type, at] = types[1]
    if (type[0] !== 'sealed') { return no(`${name} of ${show(type)} is not in this slice`) }
    const held = type[3] ?? kinds
    const base = x[0] === 'get' ? x[1] : name
    /** `x` at `kind` in `body`: itself where it holds no other kind, else a cast. @type {(kind: string, body: (y: Term) => Term) => Term} */
    const as = (kind, body) => held.every(k => k === kind) ? body(x) : cast(only(any, kind), x, `${base}.${kind}`, body)
    switch (name) {
        case 'kind': { return ok(float(call('Any', 'kind', [x]))) }
        case 'asBoolean': { return ok(as('boolean', y => call('Any', 'to_bool', [y]))) }
        case 'asNumber': { return ok(as('number', y => call('Any', 'to_f64', [y]))) }
        case 'asString': { return ok(as('string', y => y)) }
        case 'length': { return ok(lengthOf(x, held, base)) }
        default: {
            // JavaScript reads an index and a unit as numbers: the index must hold an integer exactly.
            if (!isFloat(at)) { return no(`unit at ${show(at)} is not in this slice`) }
            // JavaScript reads both arguments before `unit` casts the string, so an index that does
            // something is bound to a local first, after the string where that does something too.
            if (!isPure(i)) {
                return isPure(x) ? bindTerm(scope, i, (s, k) => viewCall(s, name, [x, get(k)]))
                    : bindTerm(scope, x, (s, k) => viewCall(s, name, [get(k), i]))
            }
            const index = `${i[0] === 'get' ? i[1] : 'unit'}.index`
            return ok(float(as('string', y => exact(u(31), i, index, k => call('String', 'unit', [y, k])))))
        }
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
 * operator, of a function of the L0 view, or of a function that the
 * function defines, which is inlined: the callee is a binding that stands
 * for one.
 *
 * @type {(scope: _Scope, callee: Value, items: readonly Item<Value>[]) => Result<Term, string>}
 */
const callTerm = (scope, callee, items) => {
    const no = refuse(scope)
    const m = callee instanceof Array && callee[0] === 'ref' ? meaning(scope, callee[1]) : null
    if (m === null || m[0] === 'local' || m[0] === 'term') { return no('a call of a value is not in this slice') }
    const xs = okList(items.map(item => isSpread(item) ? no('a spread argument is not in this slice') : value(scope, item)))
    if (xs[0] === 'error') { return xs }
    switch (m[0]) {
        case 'l0': { return viewCall(scope, m[1], xs[1]) }
        case 'inline': { return inline(scope, m[1], xs[1]) }
        case 'function': { return ok(call('self', m[1], xs[1])) }
        default: { return ok(['op', m[1], xs[1]]) }
    }
}

/**
 * `a > b` as `lt(b, a)`, and `a >= b` as `le(b, a)`, with `a` still done
 * first: where it is no local or literal it is bound to a local before `b`,
 * since either may trap and a loop may never end.
 *
 * @type {(scope: _Scope, f: (a: Term, b: Term) => Term, a: Value, b: Value) => Result<Term, string>}
 */
const swapped = (scope, f, a, b) => {
    const x = value(scope, a)
    if (x[0] === 'error') { return x }
    /** `b`, where `s` is the scope, before `y`. @type {(s: _Scope, y: Term) => Result<Term, string>} */
    const before = (s, y) => {
        const r = value(s, b)
        return r[0] === 'error' ? r : ok(f(r[1], y))
    }
    return isPure(x[1]) ? before(scope, x[1]) : bindTerm(scope, x[1], (s, name) => before(s, get(name)))
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
                : m[0] === 'term' ? ok(m[1])
                : tag !== undefined ? ok(lit(f64c, tag[1]))
                : no('a function as a value is not in this slice')
        }
        case 'function': { return no('a function as a value is not in this slice') }
        case 'block': { return block(scope, v[1], ['value']) }
        case 'if': { return choice(scope, v[1], v[2], v[3], ['value']) }
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
        case '>': { return swapped(scope, lt, v[1], v[2]) }
        case '>=': { return swapped(scope, le, v[1], v[2]) }
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
    const body = block({ ir: { name, locals: params, result, functions, imports }, bindings, depth: 0, loops: [], inlined: false }, f.body, ['return'])
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
