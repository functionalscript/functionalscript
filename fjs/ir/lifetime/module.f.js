/**
 * The lifetime pass: a module's plain stage to its owned stage
 * ([definition.md: Stages](../../../doc/sasha-gil/ir/definition.md#stages)).
 * In the plain stage a module reads a value of a sealed type as often as it
 * needs, and nothing copies or drops one. In the owned stage each owned
 * value is consumed once on every path. The pass writes the `dup` and the
 * `drop` that each sealed type's interface names between the two, as
 * definition.md's prototype pass did, and the
 * [check of the owned stage](../check/owned/module.f.js) then checks what
 * it wrote, so a mistake of the pass is a refusal, never a leak.
 *
 * - **Temporaries get names first.** A value of a sealed type that is only
 *   lent, as a borrowed argument or the operand of a `match`, is bound to a
 *   local, so that something drops it after the call or the arms. Every
 *   argument before it that does something is bound too, which keeps the
 *   order of evaluation.
 * - **A local moves at its last use** where its context takes the value
 *   over: an `own` argument, a `let`, a loop's first or next value, a
 *   function's result or a region's value. Any other such use, and such a
 *   use of a borrow, is a `dup` of it, and a use that borrows lends it. A
 *   `match` lends what its operand reads to each arm that names the
 *   operand, and only to those, so the arms of an `if` may move what its
 *   condition read.
 * - **A `let` owns its value, a loop its parameters, a function its result
 *   and a constant its value**, where they are of a sealed type.
 * - **A constant is a borrow**, which nothing drops: a use that takes it
 *   over is a `dup` of it.
 * - **A product borrows.** One that holds a sealed value leans on the
 *   locals that it was made from, which live while it does, and nothing
 *   copies or drops it. So a field of a sealed type that it is made with is
 *   a local or a field of another product: the checker refuses one that
 *   would have to be owned.
 * - **What a scope still owns is dropped where it ends**, after its value
 *   is computed: a `let`'s local, an `own` parameter, a loop's parameter.
 *   What one arm of a `match` consumed, each other arm drops. A term of
 *   type `never` does not complete, so nothing is dropped after it: a `br`
 *   drops what it leaves first, and a `trap` abandons it.
 * - **Inside a `block` or a `loop`, the locals of the regions around it are
 *   lent**, and a `br` drops what the regions that it leaves own, after its
 *   value, which a local holds meanwhile.
 * - **A linear type has no `dup` and no `drop`**, so a use that would need
 *   one is refused.
 *
 * New locals are named `$0`, `$1`, … in each function, past any name that
 * the function binds already.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { ConstantOf, FunctionOf, Interface, LoopParamOf, Module, Sealed, SealedDef, Signature, Term, Type, Typed, TypedArm } from '../types.ts'
 * @import { _Env, _Frame, _Go, _Local, _Mode, _Name, _Step, _Steps } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { error, ok, okList } from '../../types/result/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { checkPlain } from '../check/module.f.js'
import { equal, isOwn, never } from '../module.f.js'
import { show } from '../print/module.f.js'

// sets of names, as lists

/** No name. @type {readonly string[]} */
const nothing = []

/** The names of `a` that `b` does not have. @type {(a: readonly string[], b: readonly string[]) => readonly string[]} */
const minus = (a, b) => a.filter(x => !b.includes(x))

/** The names of `a`, then those of `b` that `a` does not have. @type {(a: readonly string[], b: readonly string[]) => readonly string[]} */
const union = (a, b) => [...a, ...minus(b, a)]

// terms

/** Whether a value of a type holds a value of a sealed type: it is one, or a product with a field that holds one. @type {(t: Type) => boolean} */
const holds = t => t[0] === 'sealed' || (t[0] === 'product' && t[1].some(([, x]) => holds(x)))

/** Whether a term is a value already, so that naming it changes no order of evaluation: a local, a literal, a constant or a field of such a value. @type {(t: Typed) => boolean} */
const isSimple = ([, t]) => t[0] === 'get' || t[0] === 'lit' || t[0] === 'constant' || (t[0] === 'field' && isSimple(t[1]))

/**
 * Whether a term may complete. A term of type `never` does not, and the
 * checker refuses one where a value is used, so it is the body of a
 * function, a `block`, a `loop`, a `let` or an arm, and nothing else.
 *
 * @type {(t: Typed) => boolean}
 */
const completes = ([type]) => !equal(type, never)

/** The locals that a term reads. @type {(t: Typed) => readonly string[]} */
const free = ([, t]) => {
    /** @type {(ts: readonly Typed[]) => readonly string[]} */
    const all = ts => ts.reduce((r, x) => union(r, free(x)), nothing)
    switch (t[0]) {
        case 'get': { return [t[1]] }
        case 'let': { return union(free(t[2]), minus(free(t[3]), [t[1]])) }
        case 'op': { return all(t[2]) }
        case 'call': { return all(t[3]) }
        case 'make': { return all(t[1].map(([, x]) => x)) }
        case 'field': { return free(t[1]) }
        case 'variant': { return free(t[3]) }
        case 'match': { return t[2].reduce((r, [, binder, body]) => union(r, minus(free(body), binder === null ? nothing : [binder])), free(t[1])) }
        case 'block': { return free(t[3]) }
        case 'loop': { return union(all(t[2].map(([, , first]) => first)), minus(free(t[3]), t[2].map(([k]) => k))) }
        case 'br': { return free(t[2]) }
        default: { return nothing }
    }
}

/** The names that a term binds: of a `let`, of an arm and of a loop's parameter. @type {(t: Typed) => readonly string[]} */
const bound = ([, t]) => {
    switch (t[0]) {
        case 'let': { return [t[1], ...bound(t[2]), ...bound(t[3])] }
        case 'op': { return t[2].flatMap(x => bound(x)) }
        case 'call': { return t[3].flatMap(x => bound(x)) }
        case 'make': { return t[1].flatMap(([, x]) => bound(x)) }
        case 'field': { return bound(t[1]) }
        case 'variant': { return bound(t[3]) }
        case 'match': { return [...bound(t[1]), ...t[2].flatMap(([, binder, body]) => [...(binder === null ? nothing : [binder]), ...bound(body)])] }
        case 'block': { return bound(t[3]) }
        case 'loop': { return [...t[2].flatMap(([k, , first]) => [k, ...bound(first)]), ...bound(t[3])] }
        case 'br': { return bound(t[2]) }
        default: { return nothing }
    }
}

// new names

/** The first name `$k`, from `k = n`, that the function does not take, and the number after it. @type {(taken: readonly string[], n: number) => readonly [string, number]} */
const fresh = (taken, n) => taken.includes(`$${n}`) ? fresh(taken, n + 1) : [`$${n}`, n + 1]

/** `count` new names, and the number after the last. @type {(taken: readonly string[], count: number, n: number) => readonly [readonly string[], number]} */
const freshMany = (taken, count, n) => {
    if (count === 0) { return [nothing, n] }
    const [x, n1] = fresh(taken, n)
    const [xs, n2] = freshMany(taken, count - 1, n1)
    return [[x, ...xs], n2]
}

// the environment

/** A refusal, with the function's name. @type {(env: _Env, message: string) => Result<never, string>} */
const no = (env, message) => error(`${env.fn}: ${message}`)

/** The signature of a function that a call names. @type {(env: _Env, module: string, name: string) => Signature} */
const signatureOf = (env, module, name) => module === 'self' ? assertNotNullish(at(name)(env.functions))
    : assertNotNullish(assertNotNullish(at(module)(env.imports)).functions.find(([k]) => k === name))[1]

/** A local, as the pass sees it. @type {(env: _Env, x: string) => _Local} */
const localOf = (env, x) => assertNotNullish(at(x)(env.locals))

/** A scope with one more local. @type {(env: _Env, x: string, l: _Local) => _Env} */
const bind = (env, x, l) => ({ ...env, locals: setReplace(x)(l)(env.locals) })

/** The locals that a local leans on: what a product was made from, and nothing for any other local. @type {(env: _Env, x: string) => readonly string[]} */
const leansOn = (env, x) => {
    const l = localOf(env, x)
    return l[0] === 'view' ? l[1] : nothing
}

/** The locals that a term reads, with those that the products among them lean on. @type {(env: _Env, t: Typed) => readonly string[]} */
const readsOf = (env, t) => free(t).reduce((r, x) => union(r, leansOn(env, x)), free(t))

/** Whether a local is read after a term: itself, or a product that leans on it. @type {(env: _Env, x: string, live: readonly string[]) => boolean} */
const isLive = (env, x, live) => live.includes(x) || live.some(y => leansOn(env, y).includes(x))

/** The local that binds a value of a type, from its initializer: owned, a product that leans on what its initializer reads, or plain. @type {(env: _Env, t: Type, e: Typed) => _Local} */
const bindingOf = (env, t, e) => t[0] === 'sealed' ? ['own', t] : holds(t) ? ['view', readsOf(env, e)] : ['plain']

/** How a value of a type is given where a region takes it: owned, where the type is sealed. @type {(t: Type) => _Mode} */
const modeOf = t => t[0] === 'sealed' ? 'take' : 'read'

/** Terms that their context borrows. @type {(ts: readonly Typed[]) => readonly (readonly [Typed, _Mode])[]} */
const reading = ts => ts.map(x => [x, 'read'])

/** What a sealed type's interface says of it. @type {(env: _Env, t: Sealed) => SealedDef} */
const defOf = (env, [, module, name]) => assertNotNullish(assertNotNullish(at(module)(env.imports)).types.find(([k]) => k === name))[1]

/** A copy of a value of a sealed type, which its context owns, or why there is none. @type {(env: _Env, t: Sealed, e: Term, what: string) => Result<Term, string>} */
const dupOf = (env, t, e, what) => {
    const { dup } = defOf(env, t)
    return dup === undefined ? no(env, `a copy of ${what} is needed, and ${show(t)} is linear: nothing copies it`) : ok(['call', t[1], dup, [e]])
}

/** The drop of an owned local, or why there is none. @type {(env: _Env, x: string) => Result<Term, string>} */
const dropOf = (env, x) => {
    const l = localOf(env, x)
    assert(l[0] === 'own')
    const [, t] = l
    const { drop } = defOf(env, t)
    return drop === undefined ? no(env, `${x} is left over, and ${show(t)} is linear: nothing drops it`) : ok(['call', t[1], drop, [['get', x]]])
}

/** Terms done in their order, each bound to a new name that nothing reads, then `last`. @type {(env: _Env, terms: readonly Term[], last: Term, n: number) => readonly [Term, number]} */
const chain = (env, terms, last, n) => {
    const [names, n1] = freshMany(env.taken, terms.length, n)
    /** @type {(rest: Term, x: Term, k: number) => Term} */
    const link = (rest, x, k) => ['let', names[Number(k)], x, rest]
    return [terms.reduceRight(link, last), n1]
}

/**
 * A term, then the drops of the owned locals `names`, the term's value kept
 * by a new local meanwhile.
 *
 * @type {(env: _Env, term: Term, names: readonly string[], n: number) => Result<readonly [Term, number], string>}
 */
const after = (env, term, names, n) => {
    if (names.length === 0) { return ok([term, n]) }
    const drops = okList(names.map(x => dropOf(env, x)))
    if (drops[0] === 'error') { return drops }
    const [r, n1] = fresh(env.taken, n)
    const [rest, n2] = chain(env, drops[1], ['get', r], n1)
    return ok([['let', r, term, rest], n2])
}

// the first pass: temporaries

/**
 * A call, its temporaries named: each argument that its parameter borrows,
 * of a sealed type and no value already, and every argument before the last
 * of those that does something, bound to a new local around the call.
 *
 * @type {(env: _Env, type: Type, module: string, name: string, args: readonly Typed[], n: number) => readonly [Typed, number]}
 */
const namedCall = (env, type, module, name, args, n) => {
    const { params } = signatureOf(env, module, name)
    const lent = args.map((x, k) => !isOwn(params[Number(k)]) && x[0][0] === 'sealed' && !isSimple(x))
    const last = lent.lastIndexOf(true)
    const [names, n1] = args.reduce(
        /** @type {(acc: readonly [readonly (string | null)[], number], x: Typed, k: number) => readonly [readonly (string | null)[], number]} */
        ([done, m], x, k) => {
            if (k > last || isSimple(x)) { return [[...done, null], m] }
            const [y, m1] = fresh(env.taken, m)
            return [[...done, y], m1]
        },
        [[], n])
    /** @type {Typed} */
    const call = [type, ['call', module, name, args.map((x, k) => {
        const y = names[Number(k)]
        return y === null ? x : [x[0], ['get', y]]
    })]]
    /** @type {(body: Typed, y: string | null, k: number) => Typed} */
    const wrap = (body, y, k) => y === null ? body : [type, ['let', y, args[Number(k)], body]]
    return [names.reduceRight(wrap, call), n1]
}

/** @type {_Name} */
const named = (env, typed, n) => {
    const [type, t] = typed
    /** @type {(ts: readonly Typed[], m: number) => readonly [readonly Typed[], number]} */
    const each = (ts, m) => ts.reduce(
        /** @type {(acc: readonly [readonly Typed[], number], x: Typed) => readonly [readonly Typed[], number]} */
        ([done, k], x) => {
            const [y, k1] = named(env, x, k)
            return [[...done, y], k1]
        },
        [[], m])
    switch (t[0]) {
        case 'let': {
            const [[e, body], n1] = each([t[2], t[3]], n)
            return [[type, ['let', t[1], e, body]], n1]
        }
        case 'op': {
            const [args, n1] = each(t[2], n)
            return [[type, ['op', t[1], args]], n1]
        }
        case 'call': {
            const [args, n1] = each(t[3], n)
            return namedCall(env, type, t[1], t[2], args, n1)
        }
        case 'make': {
            const [xs, n1] = each(t[1].map(([, x]) => x), n)
            return [[type, ['make', t[1].map(([k], j) => [k, xs[Number(j)]])]], n1]
        }
        case 'field': {
            const [[e], n1] = each([t[1]], n)
            return [[type, ['field', e, t[2]]], n1]
        }
        case 'variant': {
            const [[e], n1] = each([t[3]], n)
            return [[type, ['variant', t[1], t[2], e]], n1]
        }
        case 'match': {
            const [[e, ...bodies], n1] = each([t[1], ...t[2].map(([, , body]) => body)], n)
            /** @type {readonly TypedArm[]} */
            const arms = t[2].map(([variants, binder, , written], k) => [variants, binder, bodies[Number(k)], written])
            if (e[0][0] !== 'sealed' || isSimple(e)) { return [[type, ['match', e, arms]], n1] }
            const [y, n2] = fresh(env.taken, n1)
            return [[type, ['let', y, e, [type, ['match', [e[0], ['get', y]], arms]]]], n2]
        }
        case 'block': {
            const [[body], n1] = each([t[3]], n)
            return [[type, ['block', t[1], t[2], body]], n1]
        }
        case 'loop': {
            const [firsts, n1] = each(t[2].map(([, , first]) => first), n)
            const [[body], n2] = each([t[3]], n1)
            return [[type, ['loop', t[1], t[2].map(([k, x], j) => [k, x, firsts[Number(j)]]), body]], n2]
        }
        case 'br': {
            const [[e], n1] = each([t[2]], n)
            return [[type, ['br', t[1], e]], n1]
        }
        default: { return [typed, n] }
    }
}

// the second pass: ownership

/**
 * Terms that give values, written in their order, each as its mode says,
 * from the owned locals that the one before leaves, while what the ones
 * after it read, and `live`, is read later.
 *
 * @type {(go: _Go, env: _Env, items: readonly (readonly [Typed, _Mode])[], owned: readonly string[], live: readonly string[], n: number) => Result<_Steps, string>}
 */
const sequence = (go, env, items, owned, live, n) => {
    /** @type {(acc: Result<_Steps, string>, item: readonly [Typed, _Mode], k: number) => Result<_Steps, string>} */
    const step = (acc, [x, mode], k) => {
        if (acc[0] === 'error') { return acc }
        const { terms, owned: o, n: m } = acc[1]
        const later = items.slice(k + 1).reduce((r, [y]) => union(r, free(y)), live)
        const r = go(env, x, mode, o, later, m)
        return r[0] === 'error' ? r : ok({ terms: [...terms, r[1].term], owned: r[1].owned, n: r[1].n })
    }
    return items.reduce(step, ok({ terms: [], owned, n }))
}

/**
 * A `get`: a local of no sealed type, or one that its context borrows, as
 * it is; an owned local at its last use, where its context takes it over,
 * moved; and anywhere else that its context takes it over, a copy.
 *
 * @type {(env: _Env, type: Type, x: string, mode: _Mode, owned: readonly string[], live: readonly string[], n: number) => Result<_Step, string>}
 */
const getStep = (env, type, x, mode, owned, live, n) => {
    /** @type {Term} */
    const term = ['get', x]
    if (type[0] !== 'sealed' || mode === 'read') { return ok({ term, owned, n }) }
    if (owned.includes(x) && !isLive(env, x, live)) { return ok({ term, owned: minus(owned, [x]), n }) }
    const d = dupOf(env, type, term, x)
    return d[0] === 'error' ? d : ok({ term: d[1], owned, n })
}

/**
 * A `let`: its value taken over, so that the local owns it where it is of a
 * sealed type, then the body, after whose value the local is dropped where
 * the body did not consume it.
 *
 * @type {(go: _Go, env: _Env, x: string, e: Typed, body: Typed, mode: _Mode, owned: readonly string[], live: readonly string[], n: number) => Result<_Step, string>}
 */
const letStep = (go, env, x, e, body, mode, owned, live, n) => {
    const v = go(env, e, 'take', owned, union(live, minus(free(body), [x])), n)
    if (v[0] === 'error') { return v }
    const { term: init, owned: o1, n: n1 } = v[1]
    const local = bindingOf(env, e[0], e)
    const inner = bind(env, x, local)
    const b = go(inner, body, mode, local[0] === 'own' ? [...o1, x] : o1, live, n1)
    if (b[0] === 'error') { return b }
    const { term: rest, owned: o2, n: n2 } = b[1]
    if (!completes(body) || !o2.includes(x)) { return ok({ term: ['let', x, init, rest], owned: o2, n: n2 }) }
    const d = after(inner, rest, [x], n2)
    return d[0] === 'error' ? d : ok({ term: ['let', x, init, d[1][0]], owned: minus(o2, [x]), n: d[1][1] })
}

/**
 * A `match`: its operand lent to each arm that names it, whose name borrows
 * it, so that such an arm moves no local that the operand reads; then each
 * arm, from what the operand leaves, and each arm that completes drops what
 * another consumed. An arm that names no operand borrows nothing of it, so
 * it may move what the operand read, as the arms of an `if` do.
 *
 * @type {(go: _Go, env: _Env, mode: _Mode, operand: Typed, arms: readonly TypedArm[], owned: readonly string[], live: readonly string[], n: number) => Result<_Step, string>}
 */
const matchStep = (go, env, mode, operand, arms, owned, live, n) => {
    const later = arms.reduce((r, [, binder, body]) => union(r, minus(free(body), binder === null ? nothing : [binder])), live)
    const o = go(env, operand, 'read', owned, later, n)
    if (o[0] === 'error') { return o }
    const { term: e, owned: from, n: n1 } = o[1]
    const inside = union(live, free(operand))
    /** @type {(acc: Result<readonly [readonly (readonly [TypedArm, _Step])[], number], string>, arm: TypedArm) => Result<readonly [readonly (readonly [TypedArm, _Step])[], number], string>} */
    const walk = (acc, arm) => {
        if (acc[0] === 'error') { return acc }
        const [done, m] = acc[1]
        const [, binder, body] = arm
        const r = binder === null ? go(env, body, mode, from, live, m) : go(bind(env, binder, ['borrow']), body, mode, from, inside, m)
        return r[0] === 'error' ? r : ok([[...done, [arm, r[1]]], r[1].n])
    }
    const walked = arms.reduce(walk, ok([[], n1]))
    if (walked[0] === 'error') { return walked }
    const [steps, n2] = walked[1]
    const open = steps.flatMap(([[, , body], s]) => completes(body) ? [s.owned] : [])
    const left = from.filter(x => open.every(os => os.includes(x)))
    /** @type {(acc: Result<readonly [readonly (readonly [readonly string[] | null, string | null, Term])[], number], string>, step: readonly [TypedArm, _Step]) => Result<readonly [readonly (readonly [readonly string[] | null, string | null, Term])[], number], string>} */
    const finish = (acc, [[, binder, body, written], s]) => {
        if (acc[0] === 'error') { return acc }
        const [done, m] = acc[1]
        const d = completes(body) ? after(env, s.term, minus(s.owned, left), m) : ok([s.term, m])
        return d[0] === 'error' ? d : ok([[...done, [written, binder, d[1][0]]], d[1][1]])
    }
    const finished = steps.reduce(finish, ok([[], n2]))
    if (finished[0] === 'error') { return finished }
    const [written, n3] = finished[1]
    return ok({ term: ['match', e, written], owned: left, n: n3 })
}

/**
 * A `loop`: the first values, taken over, so that each parameter of a
 * sealed type owns its value; then the body, a region of its own, which the
 * locals around it are lent to, after whose value what is left of the
 * parameters is dropped.
 *
 * @type {(go: _Go, env: _Env, mode: _Mode, label: string, params: readonly (readonly [string, Type, Typed])[], body: Typed, owned: readonly string[], live: readonly string[], n: number) => Result<_Step, string>}
 */
const loopStep = (go, env, mode, label, params, body, owned, live, n) => {
    /** @type {readonly (readonly [Typed, _Mode])[]} */
    const items = params.map(([, , first]) => [first, 'take'])
    const r = sequence(go, env, items, owned, union(live, minus(free(body), params.map(([k]) => k))), n)
    if (r[0] === 'error') { return r }
    const { terms, owned: o, n: n1 } = r[1]
    /** @type {_Frame} */
    const frame = [label, o, ['loop', params.map(([, x]) => modeOf(x))]]
    const inner = { ...params.reduce((x, [k, t, first]) => bind(x, k, bindingOf(env, t, first)), env), frames: [...env.frames, frame] }
    const b = go(inner, body, mode, params.flatMap(([k, x]) => x[0] === 'sealed' ? [k] : []), live, n1)
    if (b[0] === 'error') { return b }
    const { term: rest, owned: o2, n: n2 } = b[1]
    const d = completes(body) ? after(inner, rest, o2, n2) : ok([rest, n2])
    if (d[0] === 'error') { return d }
    /** @type {readonly LoopParamOf<Term>[]} */
    const firsts = params.map(([k, x], j) => [k, x, terms[Number(j)]])
    return ok({ term: ['loop', label, firsts, d[1][0]], owned: o, n: d[1][1] })
}

/** The next values of a repeat, which the checker writes as a `make` of the loop's parameters in their order. @type {(t: Typed) => readonly (readonly [string, Typed])[]} */
const repeatOf = ([, t]) => {
    assert(t[0] === 'make')
    return t[1]
}

/** Whether a term is a value that no drop changes: a local or a literal. @type {(t: Term) => boolean} */
const isValue = t => t[0] === 'get' || t[0] === 'lit'

/**
 * A `br`: its values, taken over where the label owns them, then the drops
 * of what the regions that it leaves own, each value held by a new local
 * meanwhile, then the transfer. A `br` to a loop gives each parameter its
 * next value, and to a block or to `return` one value.
 *
 * @type {(go: _Go, env: _Env, label: string, value: Typed, owned: readonly string[], n: number) => Result<_Step, string>}
 */
const brStep = (go, env, label, value, owned, n) => {
    const k = env.frames.findLastIndex(([l]) => l === label)
    const [, , target] = env.frames[Number(k)]
    const next = target[0] === 'loop' ? repeatOf(value) : []
    /** @type {readonly (readonly [Typed, _Mode])[]} */
    const items = target[0] === 'loop' ? next.map(([, x], j) => [x, target[1][Number(j)]]) : [[value, target[0] === 'block' ? target[1] : 'take']]
    const r = sequence(go, env, items, owned, nothing, n)
    if (r[0] === 'error') { return r }
    const { terms, owned: o, n: n1 } = r[1]
    /** @type {(xs: readonly Term[]) => Term} */
    const transfer = xs => ['br', label, target[0] === 'loop' ? ['make', next.map(([f], j) => [f, xs[Number(j)]])] : xs[0]]
    const leaving = env.frames.slice(k + 1).reduce((x, [, outer]) => union(x, outer), o)
    if (leaving.length === 0) { return ok({ term: transfer(terms), owned: o, n: n1 }) }
    const drops = okList(leaving.map(x => dropOf(env, x)))
    if (drops[0] === 'error') { return drops }
    const [names, n2] = terms.reduce(
        /** @type {(acc: readonly [readonly (string | null)[], number], x: Term) => readonly [readonly (string | null)[], number]} */
        ([done, m], x) => {
            if (isValue(x)) { return [[...done, null], m] }
            const [y, m1] = fresh(env.taken, m)
            return [[...done, y], m1]
        },
        [[], n1])
    const [exit, n3] = chain(env, drops[1], transfer(terms.map((x, j) => {
        const y = names[Number(j)]
        return y === null ? x : ['get', y]
    })), n2)
    /** @type {(rest: Term, y: string | null, j: number) => Term} */
    const hold = (rest, y, j) => y === null ? rest : ['let', y, terms[Number(j)], rest]
    return ok({ term: names.reduceRight(hold, exit), owned: o, n: n3 })
}

/** @type {_Go} */
const go = (env, typed, mode, owned, live, n) => {
    const [type, t] = typed
    switch (t[0]) {
        case 'get': { return getStep(env, type, t[1], mode, owned, live, n) }
        case 'let': { return letStep(go, env, t[1], t[2], t[3], mode, owned, live, n) }
        case 'op': {
            const r = sequence(go, env, reading(t[2]), owned, live, n)
            if (r[0] === 'error') { return r }
            const { terms, owned: o, n: n1 } = r[1]
            /** @type {Term} */
            const term = type[0] === 'int' && t[1] === 'trunc_sat' ? ['op', t[1], terms, type] : ['op', t[1], terms]
            return ok({ term, owned: o, n: n1 })
        }
        case 'call': {
            const [, module, name, args] = t
            const { params } = signatureOf(env, module, name)
            /** @type {readonly (readonly [Typed, _Mode])[]} */
            const items = args.map((x, k) => [x, isOwn(params[Number(k)]) ? 'take' : 'read'])
            const lent = args.reduce((r, x, k) => isOwn(params[Number(k)]) ? r : union(r, free(x)), nothing)
            const r = sequence(go, env, items, owned, union(live, lent), n)
            if (r[0] === 'error') { return r }
            const { terms, owned: o, n: n1 } = r[1]
            return ok({ term: ['call', module, name, terms], owned: o, n: n1 })
        }
        case 'make': {
            const r = sequence(go, env, reading(t[1].map(([, x]) => x)), owned, live, n)
            if (r[0] === 'error') { return r }
            const { terms, owned: o, n: n1 } = r[1]
            /** @type {readonly (readonly [string, Term])[]} */
            const fields = t[1].map(([k], j) => [k, terms[Number(j)]])
            return ok({ term: ['make', fields], owned: o, n: n1 })
        }
        case 'field': {
            const r = go(env, t[1], 'read', owned, live, n)
            if (r[0] === 'error') { return r }
            const { term: e, owned: o, n: n1 } = r[1]
            /** @type {Term} */
            const read = ['field', e, t[2]]
            if (type[0] !== 'sealed' || mode === 'read') { return ok({ term: read, owned: o, n: n1 }) }
            const d = dupOf(env, type, read, `field ${t[2]}`)
            return d[0] === 'error' ? d : ok({ term: d[1], owned: o, n: n1 })
        }
        case 'variant': {
            const r = go(env, t[3], 'read', owned, live, n)
            return r[0] === 'error' ? r : ok({ term: ['variant', t[1], t[2], r[1].term], owned: r[1].owned, n: r[1].n })
        }
        case 'match': { return matchStep(go, env, mode, t[1], t[2], owned, live, n) }
        case 'block': {
            const [, label, x, body] = t
            /** @type {_Frame} */
            const frame = [label, owned, ['block', mode]]
            const r = go({ ...env, frames: [...env.frames, frame] }, body, mode, nothing, live, n)
            return r[0] === 'error' ? r : ok({ term: ['block', label, x, r[1].term], owned, n: r[1].n })
        }
        case 'loop': { return loopStep(go, env, mode, t[1], t[2], t[3], owned, live, n) }
        case 'br': { return brStep(go, env, t[1], t[2], owned, n) }
        case 'constant': {
            if (type[0] !== 'sealed' || mode === 'read') { return ok({ term: t, owned, n }) }
            const d = dupOf(env, type, t, `${t[1]}.${t[2]}`)
            return d[0] === 'error' ? d : ok({ term: d[1], owned, n })
        }
        default: { return ok({ term: t, owned, n }) }
    }
}

// functions and modules

/**
 * A function's owned stage: its temporaries named, then its body written
 * from its `own` parameters of a sealed type, which it owns, and what is
 * left of them dropped after the body's value.
 *
 * @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>) => (entry: readonly [string, FunctionOf<Typed>]) => Result<readonly [string, FunctionOf<Term>], string>}
 */
const lifetimeFn = (functions, imports) => ([fn, { params, result, body }]) => {
    /** @type {readonly (readonly [string, _Local])[]} */
    const locals = params.map(p => {
        const [k, t] = p
        return [k, t[0] !== 'sealed' ? ['plain'] : isOwn(p) ? ['own', t] : ['borrow']]
    })
    /** @type {_Env} */
    const env = { fn, functions, imports, taken: [...params.map(([k]) => k), ...bound(body)], locals: fromEntries(locals), frames: [['return', nothing, ['return']]] }
    const [plain, n] = named(env, body, 0)
    const r = go(env, plain, 'take', locals.flatMap(([k, l]) => l[0] === 'own' ? [k] : []), nothing, n)
    if (r[0] === 'error') { return r }
    const { term, owned, n: n1 } = r[1]
    const d = completes(plain) ? after(env, term, owned, n1) : ok([term, n1])
    return d[0] === 'error' ? d : ok([fn, { params, result, body: d[1][0] }])
}

/**
 * A constant's owned stage: its temporaries named, then its term written
 * from no owned local, so that the constant owns its value.
 *
 * @type {(functions: OrderedMap<Signature>, imports: OrderedMap<Interface>) => (entry: readonly [string, ConstantOf<Typed>]) => Result<readonly [string, ConstantOf<Term>], string>}
 */
const lifetimeConstant = (functions, imports) => ([fn, { type, value }]) => {
    /** @type {_Env} */
    const env = { fn, functions, imports, taken: bound(value), locals: empty, frames: [] }
    const [plain, n] = named(env, value, 0)
    const r = go(env, plain, 'take', nothing, nothing, n)
    return r[0] === 'error' ? r : ok([fn, { type, value: r[1].term }])
}

/**
 * A module's owned stage, from its plain stage: each constant and each
 * function with the `dup` and the `drop` of each sealed type's interface
 * written in, or why the checker refuses the plain stage, or the pass a
 * value of a linear type that it would have to copy or drop. The
 * [checker](../check/module.f.js) then takes the answer, and checks its
 * owned stage.
 *
 * @type {(m: Module) => Result<Module, string>}
 */
export const lifetime = m => {
    const typed = checkPlain(m)
    if (typed[0] === 'error') { return typed }
    const functions = fromEntries(m.functions)
    const imports = fromEntries(m.imports)
    const constants = okList(typed[1].constants.map(lifetimeConstant(functions, imports)))
    if (constants[0] === 'error') { return constants }
    const written = okList(typed[1].functions.map(lifetimeFn(functions, imports)))
    return written[0] === 'error' ? written : ok({ imports: m.imports, constants: constants[1], functions: written[1], exports: m.exports })
}
