/**
 * The check of the owned stage, which the [checker](../module.f.js) runs on
 * a module once it has typed it: each owned value is consumed once on every
 * path, and no borrow outlives what it leans on
 * ([definition.md: Stages](../../../../doc/sasha-gil/ir/definition.md#stages)).
 * The lifetime pass (slice 6b) is what writes the owned stage; until it
 * lands, a person writes it, as the proofs do.
 *
 * - **A value of a sealed type is owned or borrowed.** A call answers an
 *   owned one where its result is of a sealed type. An `own` parameter is
 *   owned, and any other parameter borrows. A borrow leans on the owned
 *   locals that it was lent from, and a parameter's borrow leans on none,
 *   since the parameter outlives the body.
 * - **A value is consumed where something takes it over**: an `own`
 *   parameter, a `let` or a loop's parameter that binds it, and a function
 *   or a region that gives it as its value. A `get` of an owned local there
 *   moves it, and anywhere else it lends it. An owned value that nothing
 *   takes over is refused: a module binds it first.
 * - **A borrow does not outlive what it leans on.** A use of a borrow after
 *   an owned local that it leans on was consumed is refused, and so is a
 *   call that lends a local to one parameter and consumes it with another.
 * - **Every path agrees.** The arms of a `match` that complete, and the
 *   exits of a `block`, leave the same owned locals alive and agree on
 *   owning their value. A `br` leaves the regions between it and its label,
 *   so it consumes what they own first, and a `trap` abandons everything.
 * - **A loop owns or borrows each parameter, as its first value is.** A `br`
 *   that repeats gives an owned parameter an owned value, and a borrowed one
 *   a borrow that leans on no more than its first value did. It consumes
 *   what the iteration owns, the parameters included, and nothing that was
 *   alive before the loop.
 * - **A `match` lends its operand**, and the name of an arm is a borrow of
 *   it. A product holds borrows only, and no parameter of a loop is a
 *   product that holds a sealed value.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { OrderedMap } from '../../../types/ordered_map/types.ts'
 * @import { Checked, FunctionOf, Interface, LoopParamOf, Signature, Type, Typed, TypedArm } from '../../types.ts'
 * @import { _Env, _Exit, _Label, _Local, _Mode, _Out, _Seq, _Value, _Walk } from './private.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.js'
import { error, ok, okList } from '../../../types/result/module.f.js'
import { entry } from '../../../types/object/entry/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../../types/ordered_map/module.f.js'
import { equal, isOwn, never } from '../../module.f.js'

// sets of owned locals, as lists of their names

/** The names of `a` that `b` does not have. @type {(a: readonly string[], b: readonly string[]) => readonly string[]} */
const minus = (a, b) => a.filter(x => !b.includes(x))

/** The names of `a`, then those of `b` that `a` does not have. @type {(a: readonly string[], b: readonly string[]) => readonly string[]} */
const union = (a, b) => [...a, ...minus(b, a)]

/** `x is`, or `x, y are`, for a message. @type {(names: readonly string[]) => string} */
const are = names => `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'}`

// values

/** @type {_Value} */
const plain = ['plain']

/** @type {_Value} */
const owned = ['owned']

/** No owned local. @type {readonly string[]} */
const nothing = []

/** The owned locals that a value leans on: a borrow's, and none for any other value. @type {(v: _Value) => readonly string[]} */
const rootsOf = v => v[0] === 'borrowed' ? v[1] : []

/** The owned locals that a local leans on: a borrow's, and none for any other local. @type {(l: _Local) => readonly string[]} */
const leansOn = l => l[0] === 'borrow' ? l[1] : []

/** The local that binds a value. @type {(v: _Value) => _Local} */
const localOf = v => v[0] === 'owned' ? ['own'] : v[0] === 'borrowed' ? ['borrow', v[1]] : ['plain']

/** Whether a value of a type holds a value of a sealed type: it is one, or a product with a field that holds one. @type {(t: Type) => boolean} */
const holds = t => t[0] === 'sealed' || (t[0] === 'product' && t[1].some(([, x]) => holds(x)))

/** @type {(next: readonly string[] | null, value: _Value, exits: readonly _Exit[]) => _Out} */
const out = (next, value, exits) => ({ next, value, exits })

/** A refusal, with the function's name. @type {(env: _Env, message: string) => Result<never, string>} */
const no = (env, message) => error(`${assertNotNullish(entry(env, 'name'))}: ${message}`)

/**
 * The join of the ends of the paths that complete, the arms of a `match` or
 * the exits of a `block`: each leaves the same owned locals alive, and they
 * agree on owning their value. Their value is a borrow of what any of them
 * leans on. `null` stands for no path that completes, and a refusal names
 * a local that one path consumes and another does not, or says that one
 * path owns its value and another borrows it.
 *
 * @type {(ends: readonly (readonly [readonly string[], _Value])[]) => Result<readonly [readonly string[], _Value] | null, readonly ['consumed', string] | readonly ['owning']>}
 */
const join = ends => {
    if (ends.length === 0) { return ok(null) }
    const [[alive]] = ends
    const differ = ends.flatMap(([x]) => [...minus(x, alive), ...minus(alive, x)])
    const kinds = ends.map(([, v]) => v[0])
    /** @type {_Value} */
    const value = kinds.includes('owned') ? owned
        : kinds.includes('borrowed') ? ['borrowed', ends.reduce((r, [, v]) => union(r, rootsOf(v)), nothing)]
        : plain
    return differ.length > 0 ? error(/** @type {const} */ (['consumed', differ[0]]))
        : kinds.includes('owned') && kinds.includes('borrowed') ? error(/** @type {const} */ (['owning']))
        : ok([alive, value])
}

/**
 * Terms in their order, each walked from the owned locals that the one
 * before leaves and as its mode says. Where one never completes, the rest
 * are never reached, and the sequence never completes either.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], ts: readonly (readonly [Typed, _Mode])[]) => Result<_Seq, string>}
 */
const sequence = (walk, env, alive, ts) => {
    /** @type {(acc: Result<_Seq, string>, term: readonly [Typed, _Mode]) => Result<_Seq, string>} */
    const step = (acc, [t, mode]) => {
        if (acc[0] === 'error' || acc[1].owned === null) { return acc }
        const r = walk(env, acc[1].owned, t, mode)
        return r[0] === 'error' ? r : ok({ owned: r[1].next, results: [...acc[1].results, r[1].value], exits: [...acc[1].exits, ...r[1].exits] })
    }
    return ts.reduce(step, ok({ owned: alive, results: [], exits: [] }))
}

/** A scope with one more label, or with a new meaning for one in it. @type {(env: _Env, name: string, l: _Label) => _Env} */
const labelled = (env, name, l) => ({ ...env, labels: setReplace(name)(l)(env.labels) })

/**
 * A `get`: an owned local, which a context that takes its value over moves
 * and any other borrows, a borrow, while what it leans on is alive, or a
 * local of no sealed value.
 *
 * @type {(env: _Env, alive: readonly string[], name: string, mode: _Mode) => Result<_Out, string>}
 */
const getTerm = (env, alive, name, mode) => {
    const local = assertNotNullish(at(name)(env.locals))
    if (local[0] === 'plain') { return ok(out(alive, plain, [])) }
    if (local[0] === 'borrow') {
        const gone = minus(local[1], alive)
        return gone.length > 0 ? no(env, `${name} is used after ${gone[0]}, which it borrows, was consumed`) : ok(out(alive, ['borrowed', local[1]], []))
    }
    return !alive.includes(name) ? no(env, `${name} is used after it was consumed`)
        : mode === 'take' ? ok(out(minus(alive, [name]), owned, []))
        : ok(out(alive, ['borrowed', [name]], []))
}

/**
 * A call: each argument as its parameter takes it, an `own` one taken over
 * and owned, and any other borrowed, in their order; then no borrowed
 * argument may lean on a local that an argument consumed. Its value is
 * owned where its result holds a sealed value, and nothing that only
 * borrows may take it.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], type: Type, mode: _Mode, module: string, name: string, args: readonly Typed[]) => Result<_Out, string>}
 */
const callTerm = (walk, env, alive, type, mode, module, name, args) => {
    const { params } = module === 'self' ? assertNotNullish(at(name)(env.functions))
        : assertNotNullish(assertNotNullish(at(module)(env.imports)).functions.find(([k]) => k === name))[1]
    const full = module === 'self' ? name : `${module}.${name}`
    const r = sequence(walk, env, alive, args.map((x, k) => [x, isOwn(params[Number(k)]) ? 'take' : 'read']))
    if (r[0] === 'error') { return r }
    const { owned: after, results, exits } = r[1]
    if (after === null) { return ok(out(null, plain, exits)) }
    const lent = results.findIndex((v, k) => isOwn(params[Number(k)]) && v[0] !== 'owned')
    if (lent >= 0) {
        const [, arg] = args[Number(lent)]
        const param = params[Number(lent)][0]
        return no(env, arg[0] === 'get' ? `${full}'s ${param}: ${arg[1]} is borrowed` : `${full}'s ${param} is own, and its argument is borrowed`)
    }
    const gone = results.flatMap(v => minus(rootsOf(v), after))
    return gone.length > 0 ? no(env, `${full} borrows ${gone[0]}, which an argument of the call consumes`)
        : !holds(type) ? ok(out(equal(type, never) ? null : after, plain, exits))
        : mode === 'read' ? no(env, `${full} answers an owned value that nothing takes over: bind it first`)
        : ok(out(after, owned, exits))
}

/**
 * A product: its fields borrowed, in their order. It is a borrow of what
 * they lean on, which no field may consume.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], fields: readonly (readonly [string, Typed])[]) => Result<_Out, string>}
 */
const makeTerm = (walk, env, alive, fields) => {
    const r = sequence(walk, env, alive, fields.map(([, x]) => [x, 'read']))
    if (r[0] === 'error') { return r }
    const { owned: after, results, exits } = r[1]
    if (after === null) { return ok(out(null, plain, exits)) }
    const roots = results.reduce((acc, v) => union(acc, rootsOf(v)), nothing)
    const gone = minus(roots, after)
    return gone.length > 0 ? no(env, `a product borrows ${gone[0]}, which one of its fields consumes`)
        : ok(out(after, results.some(v => v[0] === 'borrowed') ? ['borrowed', roots] : plain, exits))
}

/**
 * A `let`: its value taken over by the name, which owns it where it is
 * owned and borrows it where it is a borrow, then the body, by the end of
 * which an owned name is consumed.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], mode: _Mode, name: string, e: Typed, body: Typed) => Result<_Out, string>}
 */
const letTerm = (walk, env, alive, mode, name, e, body) => {
    const v = walk(env, alive, e, 'take')
    if (v[0] === 'error') { return v }
    const { next, value, exits } = v[1]
    if (next === null) { return ok(out(null, plain, exits)) }
    const local = localOf(value)
    const b = walk({ ...env, locals: setReplace(name)(local)(env.locals) }, local[0] === 'own' ? [...next, name] : next, body, mode)
    if (b[0] === 'error') { return b }
    return b[1].next !== null && b[1].next.includes(name) ? no(env, `${name} is left over`)
        : ok(out(b[1].next, b[1].value, [...exits, ...b[1].exits]))
}

/**
 * A `match`: its operand borrowed, and its arms, each from what the operand
 * leaves, its name a borrow of the operand. The arms that complete agree.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], mode: _Mode, operand: Typed, arms: readonly TypedArm[]) => Result<_Out, string>}
 */
const matchTerm = (walk, env, alive, mode, operand, arms) => {
    const o = walk(env, alive, operand, 'read')
    if (o[0] === 'error') { return o }
    const { next, value, exits } = o[1]
    if (next === null) { return ok(out(null, plain, exits)) }
    const lent = localOf(value)
    const bodies = okList(arms.map(([, binder, body]) => walk(binder === null ? env : { ...env, locals: setReplace(binder)(lent)(env.locals) }, next, body, mode)))
    if (bodies[0] === 'error') { return bodies }
    const j = join(bodies[1].flatMap(x => x.next === null ? [] : [/** @type {const} */ ([x.next, x.value])]))
    const all = [...exits, ...bodies[1].flatMap(x => x.exits)]
    return j[0] === 'error' ? no(env, j[1][0] === 'owning' ? 'one arm of a match owns its value and another borrows it' : `${j[1][1]} is consumed on one arm of a match and not on another`)
        : j[1] === null ? ok(out(null, plain, all))
        : ok(out(j[1][0], j[1][1], all))
}

/**
 * A `block`: its body, whose end and whose exits to the block agree. The
 * exits to blocks around it go on.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], mode: _Mode, label: string, body: Typed) => Result<_Out, string>}
 */
const blockTerm = (walk, env, alive, mode, label, body) => {
    const b = walk(labelled(env, label, ['block', alive, mode]), alive, body, mode)
    if (b[0] === 'error') { return b }
    const { next, value, exits } = b[1]
    /** @type {readonly (readonly [readonly string[], _Value])[]} */
    const ends = [...(next === null ? [] : [/** @type {const} */ ([next, value])]), ...exits.flatMap(([l, x, v]) => l === label ? [/** @type {const} */ ([x, v])] : [])]
    const j = join(ends)
    const others = exits.filter(([l]) => l !== label)
    return j[0] === 'error' ? no(env, j[1][0] === 'owning' ? `one exit of block ${label} owns its value and another borrows it` : `${j[1][1]} is consumed on one exit of block ${label} and not on another`)
        : j[1] === null ? ok(out(null, plain, others))
        : ok(out(j[1][0], j[1][1], others))
}

/**
 * A `loop`: the first values, each owned or borrowed as its parameter will
 * be, and none consumed by another's; then the body, by whose end the owned
 * parameters are consumed.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], mode: _Mode, label: string, params: readonly LoopParamOf<Typed>[], body: Typed) => Result<_Out, string>}
 */
const loopTerm = (walk, env, alive, mode, label, params, body) => {
    const nested = params.find(([, x]) => x[0] === 'product' && holds(x))
    if (nested !== undefined) { return no(env, `${nested[0]} of loop ${label} is a product that holds a sealed value: not in this slice`) }
    const firsts = sequence(walk, env, alive, params.map(([, , first]) => [first, 'take']))
    if (firsts[0] === 'error') { return firsts }
    const { owned: start, results, exits } = firsts[1]
    if (start === null) { return ok(out(null, plain, exits)) }
    const gone = results.flatMap(v => minus(rootsOf(v), start))
    if (gone.length > 0) { return no(env, `a parameter of loop ${label} borrows ${gone[0]}, which another's first value consumes`) }
    /** @type {readonly (readonly [string, _Local])[]} */
    const locals = params.map(([k], j) => [k, localOf(results[Number(j)])])
    const mine = locals.flatMap(([k, l]) => l[0] === 'own' ? [k] : [])
    const inner = labelled({ ...env, locals: locals.reduce((ls, [k, l]) => setReplace(k)(l)(ls), env.locals) }, label, ['loop', start, locals])
    const b = walk(inner, [...start, ...mine], body, mode)
    if (b[0] === 'error') { return b }
    const left = b[1].next === null ? [] : minus(b[1].next, start)
    return left.length > 0 ? no(env, `${are(left)} left over`) : ok(out(b[1].next, b[1].value, [...exits, ...b[1].exits]))
}

/**
 * A `br` that repeats a loop: the next values, in the order of the
 * parameters, each owned for an owned parameter and, for a borrowed one, a
 * borrow that leans on no more than the parameter does. What the iteration
 * owns is consumed by then, and what was alive before the loop is alive.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], label: string, start: readonly string[], params: readonly (readonly [string, _Local])[], e: Typed) => Result<_Out, string>}
 */
const repeat = (walk, env, alive, label, start, params, e) => {
    const [, make] = e
    // the checker writes a repeat as a `make` of the loop's parameters
    assert(make[0] === 'make')
    const [, fields] = make
    const r = sequence(walk, env, alive, fields.map(([, x], k) => [x, params[Number(k)][1][0] === 'own' ? 'take' : 'read']))
    if (r[0] === 'error') { return r }
    const { owned: after, results, exits } = r[1]
    if (after === null) { return ok(out(null, plain, exits)) }
    const lent = results.findIndex((v, k) => params[Number(k)][1][0] === 'own' && v[0] !== 'owned')
    const wider = results.findIndex((v, k) => minus(rootsOf(v), leansOn(params[Number(k)][1])).length > 0)
    const left = minus(after, start)
    const gone = minus(start, after)
    return lent >= 0 ? no(env, `${params[Number(lent)][0]} of loop ${label} is owned, and its next value is borrowed`)
        : wider >= 0 ? no(env, `the next ${params[Number(wider)][0]} of loop ${label} borrows more than its first value`)
        : left.length > 0 ? no(env, `${are(left)} left over`)
        : gone.length > 0 ? no(env, `loop ${label} repeats after ${gone[0]} was consumed`)
        : ok(out(null, plain, exits))
}

/**
 * The end of a function, at the end of its body or at a `br` to `return`:
 * nothing it owns is left, and it owns its value where its result holds a
 * sealed value.
 *
 * @type {(env: _Env, alive: readonly string[], value: _Value) => Result<null, string>}
 */
const end = (env, alive, value) =>
    alive.length > 0 ? no(env, `${are(alive)} left over`)
    : holds(env.result) && value[0] !== 'owned' ? no(env, 'the result is borrowed, and its caller would own it')
    : ok(null)

/**
 * A `br`: to `return`, the end of the function; to a block, an exit, which
 * consumes what the regions it leaves own; to a loop, a repeat.
 *
 * @type {(walk: _Walk, env: _Env, alive: readonly string[], label: string, e: Typed) => Result<_Out, string>}
 */
const brTerm = (walk, env, alive, label, e) => {
    const target = assertNotNullish(at(label)(env.labels))
    if (target[0] === 'loop') { return repeat(walk, env, alive, label, target[1], target[2], e) }
    const r = walk(env, alive, e, target[0] === 'block' ? target[2] : 'take')
    if (r[0] === 'error') { return r }
    const { next, value, exits } = r[1]
    if (next === null) { return ok(out(null, plain, exits)) }
    if (target[0] === 'return') {
        const done = end(env, next, value)
        return done[0] === 'error' ? done : ok(out(null, plain, exits))
    }
    const left = minus(next, target[1])
    return left.length > 0 ? no(env, `${are(left)} left over`) : ok(out(null, plain, [...exits, [label, next, value]]))
}

/** @type {_Walk} */
const walk = (env, alive, [type, t], mode) => {
    switch (t[0]) {
        case 'get': { return getTerm(env, alive, t[1], mode) }
        case 'let': { return letTerm(walk, env, alive, mode, t[1], t[2], t[3]) }
        case 'op': {
            const r = sequence(walk, env, alive, t[2].map(x => [x, 'read']))
            return r[0] === 'error' ? r : ok(out(r[1].owned, plain, r[1].exits))
        }
        case 'call': { return callTerm(walk, env, alive, type, mode, t[1], t[2], t[3]) }
        case 'make': { return makeTerm(walk, env, alive, t[1]) }
        case 'field': {
            const r = walk(env, alive, t[1], 'read')
            return r[0] === 'error' ? r : ok(out(r[1].next, holds(type) ? r[1].value : plain, r[1].exits))
        }
        case 'variant': {
            const r = walk(env, alive, t[3], 'read')
            return r[0] === 'error' ? r : ok(out(r[1].next, plain, r[1].exits))
        }
        case 'match': { return matchTerm(walk, env, alive, mode, t[1], t[2]) }
        case 'block': { return blockTerm(walk, env, alive, mode, t[1], t[3]) }
        case 'loop': { return loopTerm(walk, env, alive, mode, t[1], t[2], t[3]) }
        case 'br': { return brTerm(walk, env, alive, t[1], t[2]) }
        case 'trap': { return ok(out(null, plain, [])) }
        default: { return ok(out(alive, plain, [])) }
    }
}

/** The label of a function's end. @type {_Label} */
const returns = ['return']

/**
 * A function: its body, from its `own` parameters, taken over by the
 * function's end.
 *
 * @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>) => (entry: readonly [string, FunctionOf<Typed>]) => Result<null, string>}
 */
const checkFn = (functions, imports) => ([name, { params, result, body }]) => {
    /** @type {readonly (readonly [string, _Local])[]} */
    const locals = params.map(p => [p[0], !holds(p[1]) ? ['plain'] : isOwn(p) ? ['own'] : ['borrow', []]])
    /** @type {_Env} */
    const env = { name, result, functions, imports, locals: fromEntries(locals), labels: setReplace('return')(returns)(empty) }
    const r = walk(env, locals.flatMap(([k, l]) => l[0] === 'own' ? [k] : []), body, 'take')
    return r[0] === 'error' ? r : r[1].next === null ? ok(null) : end(env, r[1].next, r[1].value)
}

/**
 * A typed module's owned stage, checked: `null` where each of its functions
 * consumes each owned value once on every path, or why one does not.
 *
 * @type {(m: Checked) => Result<null, string>}
 */
export const checkOwned = m => {
    const functions = fromEntries(m.functions)
    const imports = fromEntries(m.imports)
    const failed = m.functions.map(checkFn(functions, imports)).find(r => r[0] === 'error')
    return failed === undefined ? ok(null) : failed
}
