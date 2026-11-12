// @ts-nocheck
// A prototype of the lifetime pass of doc/sasha-gil/ir/definition.md: from
// the plain stage, where a counted value is read as often as needed, to the
// owned stage, where every owned value is consumed exactly once on every
// path and `dup` and `drop` are ordinary calls.
//
// It handles sealed types of every ownership, which is what program code
// has. It moves a value at its last use, duplicates it before any other
// consuming use, and drops what is left where its scope ends. A value
// that cannot be duplicated, or cannot be dropped, is refused there.
// Dropping right after the last use, and the check of the owned stage,
// are left out: definition.check.mjs runs the result on a host that counts
// every value instead. It accompanies definition.ir.mjs.

import { check, refuse, show, unit } from './definition.ir.mjs'

const isPlace = t => t[0] === 'get' || t[0] === 'constant'
/** A term that is a value already: naming it changes no order of evaluation. */
const isSimple = t => isPlace(t) || t[0] === 'code' || t[0] === 'variant' || (t[0] === 'lit' && t[1][0] !== 'sealed')
const union = (...sets) => new Set(sets.flatMap(s => [...s]))
const minus = (set, ...names) => new Set([...set].filter(x => !names.includes(x)))
const none = new Set()

/** The locals a term reads. */
const free = t => {
    switch (t[0]) {
        case 'get': return new Set([t[1]])
        case 'let': return union(free(t[2]), minus(free(t[3]), t[1]))
        case 'op': return union(...t.slice(t[1] === 'trunc_sat' ? 3 : 2).map(free))
        case 'call': return union(...t.slice(3).map(free))
        case 'make': return union(...Object.values(t[1]).map(free))
        case 'field': return free(t[1])
        case 'match': return union(free(t[1]), ...t[2].map(([, binder, body]) => minus(free(body), binder)))
        case 'block': return free(t[3])
        case 'loop': return union(...Object.values(t[2]).map(([, first]) => free(first)), minus(free(t[3]), ...Object.keys(t[2])))
        case 'br': return free(t[2])
        default: return none
    }
}

/**
 * Temporaries get names. A counted value that is only lent, as a borrowed
 * argument or the operand of a `match`, is bound to a local first, so that
 * there is something to drop afterwards. Every argument before it that is
 * not a value already is bound too, which keeps the order of evaluation.
 */
const nameTemporaries = checked => {
    const { type, ownership, sigOf } = checked
    let count = 0
    const go = t => {
        switch (t[0]) {
            case 'let': return ['let', t[1], go(t[2]), go(t[3])]
            case 'op': return t[1] === 'trunc_sat' ? ['op', t[1], t[2], go(t[3])] : ['op', t[1], ...t.slice(2).map(go)]
            case 'call': {
                const { params } = sigOf(t[1], t[2])
                const args = t.slice(3).map(go)
                const lent = args.map((a, k) => params[k][1] === 'borrow' && !isPlace(a) && ownership(type(t[3 + k])) !== 'copy')
                const last = lent.lastIndexOf(true)
                const names = args.map((a, k) => k <= last && (lent[k] || !isSimple(a)) ? `t${++count}` : null)
                return names.reduceRight((body, name, k) => name === null ? body : ['let', name, args[k], body],
                    ['call', t[1], t[2], ...args.map((a, k) => names[k] === null ? a : ['get', names[k]])])
            }
            case 'make': return ['make', Object.fromEntries(Object.entries(t[1]).map(([k, x]) => [k, go(x)]))]
            case 'field': return ['field', go(t[1]), t[2]]
            case 'match': {
                const arms = t[2].map(([variants, binder, body]) => [variants, binder, go(body)])
                if (isPlace(t[1]) || ownership(type(t[1])) === 'copy') { return ['match', go(t[1]), arms] }
                const name = `t${++count}`
                return ['let', name, go(t[1]), ['match', ['get', name], arms]]
            }
            case 'block': return ['block', t[1], t[2], go(t[3])]
            case 'loop': return ['loop', t[1], Object.fromEntries(Object.entries(t[2]).map(([k, [x, first]]) => [k, [x, go(first)]])), go(t[3])]
            case 'br': return ['br', t[1], go(t[2])]
            default: return t
        }
    }
    const { module } = checked
    return {
        ...module,
        constants: Object.fromEntries(Object.entries(module.constants).map(([k, [x, e]]) => [k, [x, go(e)]])),
        functions: Object.fromEntries(Object.entries(module.functions).map(([k, f]) => [k, { ...f, body: go(f.body) }])),
    }
}

/** The plain stage of a module to its owned stage. */
export const lifetime = plain => {
    const checked = check(nameTemporaries(check(plain)))
    const { module, type, ownership, decl, isNever, sigOf } = checked
    let count = 0
    const dup = (t, e) => ['call', t[1], decl(t).dup, e]
    const drop = (t, name) => ['call', t[1], decl(t).drop ?? refuse(`${name}: a ${show(t)} is left over, and it is linear`), ['get', name]]
    const chain = terms => terms.reduceRight((rest, x) => ['let', null, x, rest])
    /** `term`, and then the drops, keeping the value of `term`. */
    const after = (term, drops, t) => {
        if (drops.length === 0 || isNever(t)) { return term }
        if (show(t) === show(unit)) { return chain([term, ...drops]) }
        const r = `r${++count}`
        return ['let', r, term, chain([...drops, ['get', r]])]
    }
    const drops = (names, ctx) => [...names].map(x => drop(ctx.types.get(x), x))

    /**
     * A term whose value its context will own. `owned` is the locals this
     * region owns now, and `live` the locals that are read after the term.
     * It answers the term and what the region still owns after it.
     */
    const go = (t, owned, live, ctx) => {
        switch (t[0]) {
            case 'get': case 'constant': {
                const kind = ownership(type(t))
                if (kind === 'copy') { return [t, owned] }
                // the last use of an owned local is a move
                if (t[0] === 'get' && owned.has(t[1]) && !live.has(t[1])) { return [t, minus(owned, t[1])] }
                kind === 'counted' || refuse(`${t[1]} is ${kind}: it is consumed once, by the region that owns it, and not used after`)
                return [dup(type(t), t), owned]
            }
            case 'let': {
                const [e, o1] = go(t[2], owned, union(minus(free(t[3]), t[1]), live), ctx)
                const kind = ownership(type(t[2]))
                if (t[1] === null || kind === 'copy' || isNever(type(t[2]))) {
                    const [body, o2] = go(t[3], o1, live, ctx)
                    return [['let', t[1], e, body], o2]
                }
                const inner = { ...ctx, types: new Map(ctx.types).set(t[1], type(t[2])) }
                const [body, o2] = go(t[3], union(o1, [t[1]]), live, inner)
                // a local that its body did not consume is dropped where its scope ends
                return [['let', t[1], e, after(body, o2.has(t[1]) ? drops([t[1]], inner) : [], type(t[3]))], minus(o2, t[1])]
            }
            case 'op': {
                const from = t[1] === 'trunc_sat' ? 3 : 2
                let o = owned
                const args = t.slice(from).map((x, k, all) => {
                    const [e, next] = go(x, o, union(live, ...all.slice(k + 1).map(free)), ctx)
                    o = next
                    return e
                })
                return [[...t.slice(0, from), ...args], o]
            }
            case 'call': {
                const { params } = sigOf(t[1], t[2])
                const all = t.slice(3)
                // a lent local stays alive until the call returns
                const lent = union(...all.filter((_, k) => params[k][1] === 'borrow').map(free))
                let o = owned
                const args = all.map((x, k) => {
                    if (params[k][1] === 'borrow' && isPlace(x)) { return x }
                    const [e, next] = go(x, o, union(live, lent, ...all.slice(k + 1).map(free)), ctx)
                    o = next
                    return e
                })
                return [['call', t[1], t[2], ...args], o]
            }
            case 'make': {
                let o = owned
                const entries = Object.entries(t[1])
                const fields = entries.map(([k, x], j) => {
                    const [e, next] = go(x, o, union(live, ...entries.slice(j + 1).map(([, y]) => free(y))), ctx)
                    o = next
                    return [k, e]
                })
                return [['make', Object.fromEntries(fields)], o]
            }
            case 'field': {
                ownership(type(t)) === 'copy' || refuse('this prototype reads only copy fields')
                return [t, owned]
            }
            case 'match': {
                // the operand is lent to the arms, which may alias it
                const operand = isPlace(t[1]) ? [t[1], owned] : go(t[1], owned, union(live, ...t[2].map(([, , body]) => free(body))), ctx)
                const inside = union(live, free(t[1]))
                const arms = t[2].map(([variants, binder, body]) => [variants, binder, ...go(body, operand[1], inside, ctx), type(body)])
                const open = arms.filter(arm => !isNever(arm[4]))
                const left = open.length === 0 ? operand[1] : new Set([...operand[1]].filter(x => open.every(arm => arm[3].has(x))))
                // what one arm consumed, every other arm drops
                return [['match', operand[0], arms.map(([variants, binder, body, o, bodyType]) =>
                    [variants, binder, after(body, isNever(bodyType) ? [] : drops(minus(o, ...left), ctx), bodyType)])], left]
            }
            case 'block': {
                // inside a label, the locals of the regions around it are only lent
                const [body] = go(t[3], none, live, { ...ctx, frames: [...ctx.frames, { label: t[1], outer: owned }] })
                return [['block', t[1], t[2], body], owned]
            }
            case 'loop': {
                let o = owned
                const entries = Object.entries(t[2])
                const params = entries.map(([k, [x, first]], j) => {
                    const later = union(live, minus(free(t[3]), ...Object.keys(t[2])), ...entries.slice(j + 1).map(([, [, y]]) => free(y)))
                    const [e, next] = go(first, o, later, ctx)
                    o = next
                    return [k, [x, e]]
                })
                // each round owns its parameters
                const mine = entries.filter(([, [x]]) => ownership(x) !== 'copy')
                const inner = {
                    ...ctx,
                    frames: [...ctx.frames, { label: t[1], outer: o }],
                    types: new Map([...ctx.types, ...mine.map(([k, [x]]) => [k, x])]),
                }
                const [body, o2] = go(t[3], new Set(mine.map(([k]) => k)), live, inner)
                return [['loop', t[1], Object.fromEntries(params), after(body, drops(o2, inner), type(t[3]))], o]
            }
            case 'br': {
                const at = ctx.frames.findIndex(frame => frame.label === t[1])
                let o = owned
                // to a loop the value is the next parameters, each a term of its own
                const toLoop = t[2][0] === 'make'
                const entries = toLoop ? Object.entries(t[2][1]) : [[null, t[2]]]
                const values = entries.map(([, x], j) => {
                    const [e, next] = go(x, o, union(...entries.slice(j + 1).map(([, y]) => free(y))), ctx)
                    o = next
                    return e
                })
                const transfer = terms => ['br', t[1], toLoop ? ['make', Object.fromEntries(entries.map(([k], j) => [k, terms[j]]))] : terms[0]]
                // everything owned by the regions that the transfer leaves
                const leaving = drops(union(o, ...ctx.frames.slice(at + 1).map(frame => frame.outer)), ctx)
                if (leaving.length === 0) { return [transfer(values), none] }
                // the values first, under names, then the drops, then the transfer
                const names = values.map(e => isSimple(e) && e[0] !== 'get' ? null : `r${++count}`)
                const exit = chain([...leaving, transfer(values.map((e, j) => names[j] === null ? e : ['get', names[j]]))])
                return [names.reduceRight((body, name, j) => name === null ? body : ['let', name, values[j], body], exit), none]
            }
            default: return [t, owned]
        }
    }

    const constants = Object.fromEntries(Object.entries(module.constants).map(([k, [x, e]]) =>
        [k, [x, go(e, none, none, { frames: [], types: new Map() })[0]]]))
    const functions = Object.fromEntries(Object.entries(module.functions).map(([k, f]) => {
        const mine = f.params.filter(([, mode, x]) => mode === 'own' && ownership(x) !== 'copy')
        const ctx = { frames: [{ label: 'return', outer: none }], types: new Map(f.params.map(([name, , x]) => [name, x])) }
        const [body, left] = go(f.body, new Set(mine.map(([name]) => name)), none, ctx)
        return [k, { params: f.params, result: f.result, body: after(body, drops(left, ctx), type(f.body)) }]
    }))
    return { ...module, constants, functions }
}
