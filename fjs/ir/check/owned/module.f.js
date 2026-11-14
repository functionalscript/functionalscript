/**
 * The check of the owned stage: each owned value is consumed exactly once
 * on every path, a borrowed value is never dropped, and a use after a
 * consume is refused. The [type checker](../module.f.js) runs this after it
 * types a module. The lifetime pass (slice 6b) is what writes the owned
 * stage; this slice takes modules written in it by hand.
 *
 * A value is owned when it is an `own` parameter, the result of a call whose
 * result type is counted (a sealed type whose interface names `dup` and
 * `drop`), or a `let` of either. It is consumed as an `own` argument or as
 * the value a transfer leaves with when that value is owned. A `match`
 * lends its operand. A product that holds an owned value is refused here:
 * this slice only moves sealed values.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Checked, FunctionOf, Interface, Signature, Type, Typed, TypedTerm } from '../../types.ts'
 * @import { OrderedMap } from '../../../types/ordered_map/types.ts'
 */

import { error, ok } from '../../../types/result/module.f.js'
import { at, fromEntries } from '../../../types/ordered_map/module.f.js'
import { equal, isOwn, never } from '../../module.f.js'

/** @typedef {ReadonlySet<string>} _Owned */

/** @type {(a: _Owned, b: _Owned) => boolean} */
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x))

/** @type {(s: _Owned, name: string) => _Owned} */
const add = (s, name) => new Set([...s, name])

/** @type {(s: _Owned, name: string) => _Owned} */
const without = (s, name) => {
    const next = new Set(s)
    next.delete(name)
    return next
}

/**
 * @typedef {{
 *   readonly name: string,
 *   readonly imports: OrderedMap<Interface>,
 *   readonly functions: OrderedMap<Signature>,
 *   readonly modes: ReadonlyMap<string, 'borrow' | 'own'>,
 * }} _Env
 */

/** Whether a sealed type is counted. @type {(env: _Env, t: Type) => boolean} */
const isCounted = (env, t) => {
    if (t[0] !== 'sealed') { return false }
    const i = at(t[1])(env.imports)
    const d = i?.types.find(([k]) => k === t[2])?.[1]
    return d !== undefined && d.dup !== undefined && d.drop !== undefined
}

/** @type {(env: _Env, module: string, name: string) => Signature | null} */
const sigOf = (env, module, name) => module === 'self'
    ? at(name)(env.functions)
    : at(module)(env.imports)?.functions.find(([k]) => k === name)?.[1] ?? null

/** @type {(t: TypedTerm) => string | null} */
const placeOf = t => t[0] === 'get' ? t[1] : null

/**
 * Refuse a use of a local that was already consumed.
 * @type {(env: _Env, owned: _Owned, name: string) => Result<null, string>}
 */
const stillHere = (env, owned, name) => {
    if (env.modes.get(name) === 'own' && !owned.has(name)) {
        return error(`${env.name}: ${name} is used after it was consumed`)
    }
    return ok(null)
}

/**
 * Take ownership of a term's value: a `get` of an owned local moves it; a
 * borrowed local cannot be owned without `dup`; a call that answers a
 * counted type yields an owned temporary.
 *
 * @type {(env: _Env, owned: _Owned, typed: Typed) => Result<readonly [owned: _Owned, valueOwned: boolean], string>}
 */
const take = (env, owned, [type, t]) => {
    switch (t[0]) {
        case 'lit': case 'trap': case 'variant':
            return ok([owned, false])
        case 'get': {
            const name = t[1]
            if (!isCounted(env, type)) { return ok([owned, false]) }
            // a borrow is lent, not owned; returning it as an owned result fails later
            if (env.modes.get(name) !== 'own') {
                const alive = stillHere(env, owned, name)
                return alive[0] === 'error' ? alive : ok([owned, false])
            }
            if (!owned.has(name)) { return error(`${env.name}: ${name} is used after it was consumed`) }
            return ok([without(owned, name), true])
        }
        case 'let': {
            const [, name, e, body] = t
            const left = take(env, owned, e)
            if (left[0] === 'error') { return left }
            const [o1, eOwned] = left[1]
            /** @type {_Env} */
            const inner = { ...env, modes: new Map(env.modes).set(name, eOwned ? 'own' : 'borrow') }
            const right = take(inner, eOwned ? add(o1, name) : o1, body)
            if (right[0] === 'error') { return right }
            const [o2, bodyOwned] = right[1]
            if (o2.has(name)) { return error(`${env.name}: ${name} is left over`) }
            return ok([o2, bodyOwned])
        }
        case 'op': {
            let o = owned
            for (const x of t[2]) {
                const r = read(env, o, x)
                if (r[0] === 'error') { return r }
                o = r[1]
            }
            return ok([o, false])
        }
        case 'call': {
            const r = call(env, owned, t[1], t[2], t[3])
            if (r[0] === 'error') { return r }
            return ok([r[1], isCounted(env, type)])
        }
        case 'make': {
            let o = owned
            for (const [, x] of t[1]) {
                const r = read(env, o, x)
                if (r[0] === 'error') { return r }
                o = r[1]
            }
            return ok([o, false])
        }
        case 'field': {
            const r = read(env, owned, t[1])
            return r[0] === 'error' ? r : ok([r[1], false])
        }
        case 'match': {
            const [, operand, arms] = t
            const lent = read(env, owned, operand)
            if (lent[0] === 'error') { return lent }
            /** @type {_Owned | null} */
            let after = null
            /** @type {boolean | null} */
            let valueOwned = null
            for (const [, binder, body] of arms) {
                /** @type {_Env} */
                const inner = binder === null ? env
                    : { ...env, modes: new Map(env.modes).set(binder, 'borrow') }
                const r = take(inner, lent[1], body)
                if (r[0] === 'error') { return r }
                if (binder !== null && r[1][0].has(binder)) {
                    return error(`${env.name}: ${binder} is left over`)
                }
                if (after === null) {
                    after = r[1][0]
                    valueOwned = r[1][1]
                } else if (!sameSet(after, r[1][0]) || valueOwned !== r[1][1]) {
                    return error(`${env.name}: match arms leave different owned values`)
                }
            }
            return ok([/** @type {_Owned} */ (after), /** @type {boolean} */ (valueOwned)])
        }
        case 'block': {
            const r = take(env, owned, t[3])
            return r[0] === 'error' ? r : ok([r[1][0], r[1][1]])
        }
        case 'loop': {
            let o = owned
            for (const [, , first] of t[2]) {
                const r = read(env, o, first)
                if (r[0] === 'error') { return r }
                o = r[1]
            }
            /** @type {_Env} */
            const inner = {
                ...env,
                modes: t[2].reduce((m, [name]) => m.set(name, 'borrow'), new Map(env.modes)),
            }
            const body = take(inner, o, t[3])
            if (body[0] === 'error') { return body }
            for (const [name] of t[2]) {
                if (body[1][0].has(name)) { return error(`${env.name}: ${name} is left over`) }
            }
            return ok([body[1][0], body[1][1]])
        }
        case 'br': {
            const r = take(env, owned, t[2])
            if (r[0] === 'error') { return r }
            // the transferred value is already moved out of the owned set when it was a get
            if (r[1][0].size > 0) {
                const left = [...r[1][0]]
                return error(`${env.name}: ${left.join(', ')} ${left.length === 1 ? 'is' : 'are'} left over`)
            }
            return ok([r[1][0], false])
        }
    }
}

/**
 * Read a term without taking ownership: a borrow. A `get` of an owned local
 * stays owned; a temporary that would be owned is refused (bind it first).
 *
 * @type {(env: _Env, owned: _Owned, typed: Typed) => Result<_Owned, string>}
 */
const read = (env, owned, [type, t]) => {
    switch (t[0]) {
        case 'get': {
            const name = t[1]
            const alive = stillHere(env, owned, name)
            return alive[0] === 'error' ? alive : ok(owned)
        }
        case 'lit': case 'trap': case 'variant':
            return ok(owned)
        case 'call': {
            const r = call(env, owned, t[1], t[2], t[3])
            if (r[0] === 'error') { return r }
            if (isCounted(env, type)) {
                return error(`${env.name}: an owned temporary is borrowed; bind it first`)
            }
            return ok(r[1])
        }
        case 'let': case 'op': case 'make': case 'field': case 'match': case 'block': case 'loop': case 'br': {
            const r = take(env, owned, [type, t])
            if (r[0] === 'error') { return r }
            if (r[1][1]) { return error(`${env.name}: an owned temporary is borrowed; bind it first`) }
            return ok(r[1][0])
        }
    }
}

/**
 * Evaluate the arguments of a call under their modes.
 * @type {(env: _Env, owned: _Owned, module: string, name: string, args: readonly Typed[]) => Result<_Owned, string>}
 */
const call = (env, owned, module, name, args) => {
    const s = sigOf(env, module, name)
    if (s === null) {
        return error(`${env.name}: no function ${module === 'self' ? name : `${module}.${name}`}`)
    }
    const full = module === 'self' ? name : `${module}.${name}`
    let o = owned
    for (let k = 0; k < args.length; k += 1) {
        const arg = args[Number(k)]
        const p = s.params[Number(k)]
        if (isOwn(p)) {
            const place = placeOf(arg[1])
            if (place !== null) {
                if (env.modes.get(place) === 'borrow') {
                    return error(`${env.name}: ${full}'s ${p[0]}: ${place} is borrowed`)
                }
                if (!o.has(place)) {
                    return error(`${env.name}: ${full}'s ${p[0]}: ${place} is used after it was consumed`)
                }
                o = without(o, place)
            } else {
                const r = take(env, o, arg)
                if (r[0] === 'error') { return r }
                if (!r[1][1]) {
                    return error(`${env.name}: ${full}'s ${p[0]} is own, and the argument is not owned`)
                }
                o = r[1][0]
            }
        } else {
            const r = read(env, o, arg)
            if (r[0] === 'error') { return r }
            o = r[1]
        }
    }
    return ok(o)
}

/** @type {(imports: OrderedMap<Interface>, functions: OrderedMap<Signature>) => (entry: readonly [string, FunctionOf<Typed>]) => Result<null, string>} */
const checkFn = (imports, functions) => ([name, { params, result, body }]) => {
    /** @type {Map<string, 'borrow' | 'own'>} */
    const modes = new Map(params.map(p => [p[0], isOwn(p) ? 'own' : 'borrow']))
    /** @type {_Owned} */
    const owned = new Set(params.filter(isOwn).map(([n]) => n))
    /** @type {_Env} */
    const env = { name, imports, functions, modes }
    const r = take(env, owned, body)
    if (r[0] === 'error') { return r }
    const [left, bodyOwned] = r[1]
    if (left.size > 0) {
        const names = [...left]
        return error(`${name}: ${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} left over`)
    }
    if (!equal(body[0], never) && !equal(result, never)) {
        if (isCounted(env, result) && !bodyOwned) {
            return error(`${name}: the body does not own its result`)
        }
        if (!isCounted(env, result) && bodyOwned) {
            return error(`${name}: the body owns a value the result does not`)
        }
    }
    return ok(null)
}

/**
 * A typed module whose owned stage the checker takes, or why a function
 * breaks the ownership rules.
 *
 * @type {(m: Checked) => Result<null, string>}
 */
export const checkOwned = m => {
    const imports = fromEntries(m.imports)
    const functions = fromEntries(m.functions)
    for (const entry of m.functions) {
        const r = checkFn(imports, functions)(entry)
        if (r[0] === 'error') { return r }
    }
    return ok(null)
}
