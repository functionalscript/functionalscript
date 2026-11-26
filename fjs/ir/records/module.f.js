/**
 * The records pass: a module's plain stage again, where an object that a
 * function builds and only reads back, by keys that it has, is a local for
 * each of its values instead of an object
 * ([benchmark.md, lever 3](../../../doc/sasha-gil/ir/benchmark.md#levers)).
 * The lowering builds an object literal of values of `any` with
 * Containers, since it may leave its function, and reads one with L1's
 * `get`. Where it never leaves, the pass splits it, so nothing builds it
 * and nothing looks a key up.
 *
 * - **What the pass splits.** An object that a function builds is a
 *   `match` of Containers' `seal` of a `push_property` of each of its keys,
 *   string literals, onto `begin_object` of their count, whose arm for an
 *   object names it and whose other arm traps, as the lowering writes one.
 *   It is split where every value that it may become is read only by L1's
 *   `get` of a key that it has, through the locals that hold it: a `let`,
 *   whose value is the object at the end of a chain of `let`s, and a loop's
 *   parameter, whose first and next values are such chains. The keys of
 *   every object that a local may hold are the same, in the same order.
 * - **What keeps an object.** A `br` to a loop whose value is not a
 *   product of the loop's parameters keeps each of them. Any other use of a value that it may become:
 *   an argument of any other call, a value that the function answers, that
 *   a `block` answers, that a product, a variant or another object holds,
 *   the operand of a `match`, a read of a key that it has not, or a read
 *   of a value that may be something else. Then every object that the
 *   value may come from stays one, and so does every local that it passes
 *   through. A local that a parameter or an arm binds is never split.
 * - **How it splits.** A local `s` of keys `i` and `acc` is the locals
 *   `s.i` and `s.acc`, of `any`: a `let` binds each, a loop has a
 *   parameter for each, and a `br` gives each. The `let`s of the chain that
 *   makes its value are written before, renamed `s/#1`, so that no name
 *   that the rest reads is shadowed. A key or a name in a new name has
 *   `\`, `.` and `/` escaped by a `\`, so `s.p.q` is the key `q` of
 *   `s.p` and `s.p\.q` the key `p.q` of `s`, and no new name is another. A
 *   new split name that is already a binder of the function, or that another
 *   binder origin of the same rewrite would also write, keeps every object
 *   of that function: cast arms like `p0.array` share the `.` spelling, and
 *   escaped keys can make two origins spell the same (`r` + `x.y` and
 *   `r.x\` + `y` both write `r.x\.y`). A chain binder's origin is its
 *   prefix and name (`s` + `t` → `s/t`), so the initial and `br` values of
 *   a loop that both write `let t` under the same split local share one
 *   origin. Binders that only use those characters for kind casts do not
 *   block an unrelated split.
 *   A read `get(s, 'i')` is `s.i`, and a `let` of such a read is no
 *   local of its own but `s.i` itself, so nothing copies it. A read of a
 *   term whose value may be such an object reads the key at each end of
 *   the term instead: an object's value, or a split local's.
 * - **Nothing moves past what does something.** A chain moves before a
 *   loop or a `br` only where all but one of its values do nothing, as a
 *   local, a literal or an object of these does nothing, and a read of
 *   one key skips the other values of an object only where each of them
 *   does nothing; otherwise the object stays.
 *
 * The plain stage has no `dup` and no `drop`, so the lifetime pass that
 * runs after it owns each split local as it owns any other.
 *
 * @module
 *
 * @import { Fn, Match, Module, Term, Type } from '../types.ts'
 * @import { _Env, _Fact, _Label, _Local, _Site, _Source, _Split } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { any } from '../l0/module.f.js'
import { terms } from '../module.f.js'

/** @type {_Env} */
const top = { locals: [], labels: [] }

/** The local that a name reads where `env` stands. @type {(env: _Env, name: string) => _Local | undefined} */
const localOf = (env, name) => env.locals.find(([k]) => k === name)

/** A scope with one more local. @type {(env: _Env, local: _Local) => _Env} */
const bind = (env, local) => ({ ...env, locals: [local, ...env.locals] })

/** A scope with one more label. @type {(env: _Env, label: _Label) => _Env} */
const label_ = (env, label) => ({ ...env, labels: [label, ...env.labels] })

/** Whether a term does nothing: a local or a literal. @type {(t: Term) => boolean} */
const isPure = t => t[0] === 'get' || t[0] === 'lit'

/**
 * The keys and the values of an object that a term builds as the lowering
 * writes one, or `null`.
 *
 * @type {(t: Term) => _Site | null}
 */
const siteOf = t => {
    if (t[0] !== 'match' || t[2].length !== 2) { return null }
    const [[variants, binder, body], [rest, , other]] = t[2]
    const sealed = t[1]
    if (variants === null || variants.length !== 1 || variants[0] !== 'object' || binder === null
        || body[0] !== 'get' || body[1] !== binder || rest !== null || other[0] !== 'trap'
        || sealed[0] !== 'call' || sealed[1] !== 'Containers' || sealed[2] !== 'seal' || sealed[3].length !== 1) { return null }
    /** @type {(b: Term, done: _Site) => _Site | null} */
    const pushed = (b, done) => {
        if (b[0] !== 'call' || b[1] !== 'Containers') { return null }
        if (b[2] === 'begin_object') {
            const [count] = b[3]
            return b[3].length === 1 && count[0] === 'lit' && count[2] === BigInt(done.length) ? done : null
        }
        if (b[2] !== 'push_property' || b[3].length !== 3) { return null }
        const [inner, key, value] = b[3]
        return key[0] !== 'lit' || typeof key[2] !== 'string' || done.some(([k]) => k === key[2]) ? null
            : pushed(inner, [[key[2], value], ...done])
    }
    return pushed(sealed[3][0], [])
}

/**
 * Whether the values of a loop's parameters, or of a `br` to it, may be
 * split, whose chains then move before the others: all but one of them do
 * nothing, as a local, a literal, or an object of these does nothing.
 *
 * @type {(values: readonly Term[]) => boolean}
 */
const movable = values => values.filter(x => {
    const site = siteOf(x)
    return !isPure(x) && (site === null || !site.every(([, v]) => isPure(v)))
}).length < 2

/** A key or a name as a part of a new name: `\\`, `.` and `/` escaped. @type {(k: string) => string} */
const escape = k => k.replaceAll('\\', '\\\\').replaceAll('.', '\\.').replaceAll('/', '\\/')

/** The names that a term binds. @type {(t: Term) => readonly string[]} */
const binders = t => {
    const own = t[0] === 'let' ? [t[1]]
        : t[0] === 'loop' ? t[2].map(([k]) => k)
        : t[0] === 'match' ? t[2].flatMap(([, binder]) => binder === null ? [] : [binder])
        : []
    return [...own, ...terms(t).flatMap(binders)]
}

/** The keys of an object. @type {(site: _Site) => readonly string[]} */
const keysOf = site => site.map(([k]) => k)

/**
 * The read of a key by `get`, a call of the module's own L1 `get` of a
 * term and a string literal: the term and the key, or `null`.
 *
 * @type {(get: string, t: Term) => readonly [Term, string] | null}
 */
const readOf = (get, t) => {
    if (t[0] !== 'call' || t[1] !== 'self' || t[2] !== get || t[3].length !== 2) { return null }
    const [receiver, key] = t[3]
    return key[0] === 'lit' && typeof key[2] === 'string' ? [receiver, key[2]] : null
}

// the facts

/**
 * The facts of a function and where its value may come from: `facts(get)`
 * of a term at `path`, where `ends` says whether the values of the arms
 * of a `match` are where the term's value comes from, as for a read, or
 * whether the term only passes on the value at the end of a chain of
 * `let`s, as a local's value does.
 *
 * @type {(get: string) => (t: Term, path: string, env: _Env, ends: boolean) => readonly [readonly _Source[], readonly _Fact[]]}
 */
const facts = get => {
    /** @type {readonly _Source[]} */
    const opaque = [['opaque']]
    /** @type {(t: Term, path: string, env: _Env, ends: boolean) => readonly [readonly _Source[], readonly _Fact[]]} */
    const of = (t, path, env, ends) => {
        /**
         * The facts of a term whose value is used where `use` says: each
         * source of it escapes, or flows into a local.
         *
         * @type {(t: Term, path: string, env: _Env, use: string | null) => readonly _Fact[]}
         */
        const used = (t, path, env, use) => {
            const [from, fs] = of(t, path, env, use === null)
            return [...fs, ...from.map(s => /** @type {_Fact} */ (use === null ? ['escape', s] : ['def', use, s]))]
        }
        /** The facts of terms whose values escape, at `path` and their index. @type {(ts: readonly Term[], path: string, env: _Env) => readonly _Fact[]} */
        const all = (ts, path, env) => ts.flatMap((x, j) => used(x, `${path}/${j}`, env, null))
        const site = siteOf(t)
        if (site !== null) {
            /** @type {_Fact} */
            const fact = ['site', path, keysOf(site), site.every(([, x]) => isPure(x))]
            return [[['site', path, keysOf(site)]], [fact, ...site.flatMap(([, x], j) => used(x, `${path}/s${j}`, env, null))]]
        }
        const read = readOf(get, t)
        if (read !== null) {
            const [from, fs] = of(read[0], `${path}/0`, env, true)
            return [opaque, [...fs, ['read', path, read[1], from]]]
        }
        switch (t[0]) {
            case 'get': {
                const local = localOf(env, t[1])
                return [local === undefined ? opaque : [['bind', local[1]]], []]
            }
            case 'let': {
                const value = used(t[2], `${path}/v`, env, path)
                const [from, fs] = of(t[3], `${path}/b`, bind(env, [t[1], path, t[1]]), ends)
                return [from, [['local', path, 'split'], ...value, ...fs]]
            }
            case 'match': {
                const operand = used(t[1], `${path}/e`, env, null)
                if (!ends) { return [opaque, [...operand, ...t[2].flatMap(([, binder, x], j) => used(x, `${path}/a${j}`, binder === null ? env : bind(env, [binder, `${path}/a${j}x`, binder]), null))]] }
                const arms = t[2].map(([, binder, x], j) => {
                    const id = `${path}/a${j}x`
                    const inner = binder === null ? env : bind(env, [binder, id, binder])
                    const [from, fs] = of(x, `${path}/a${j}`, inner, true)
                    return /** @type {const} */ ([from, binder === null ? fs : [/** @type {_Fact} */ (['local', id, 'other']), ...fs]])
                })
                return [arms.flatMap(([from]) => from), [...operand, ...arms.flatMap(([, fs]) => fs)]]
            }
            case 'loop': {
                const params = t[2].map(([k], j) => /** @type {_Local} */ ([k, `${path}#${j}`, k]))
                const moved = !movable(t[2].map(([, , x]) => x))
                const firsts = t[2].flatMap(([, , x], j) => used(x, `${path}/f${j}`, env, params[Number(j)][1]))
                const inner = label_(params.reduce(bind, env), [t[1], params])
                const [from, fs] = of(t[3], `${path}/b`, inner, ends)
                /** @type {readonly _Fact[]} */
                const own = params.flatMap(([, id]) => [/** @type {_Fact} */ (['local', id, 'split']), ...(moved ? [/** @type {_Fact} */ (['bad', id])] : [])])
                return [ends ? from : opaque, [...own, ...firsts, ...(ends ? fs : [...fs, ...from.map(s => /** @type {_Fact} */ (['escape', s]))])]]
            }
            case 'br': {
                const target = env.labels.find(([k]) => k === t[1])
                const params = target === undefined ? null : target[1]
                const e = t[2]
                if (params === null) { return [[], used(e, `${path}/v`, env, null)] }
                // a loop's next state that is not a product of its parameters: none of them splits
                if (e[0] !== 'make') { return [[], [...params.map(([, id]) => /** @type {_Fact} */ (['bad', id])), ...used(e, `${path}/v`, env, null)]] }
                const moved = !movable(e[1].map(([, x]) => x))
                /** @type {readonly _Fact[]} */
                const bad = moved ? params.map(([, id]) => /** @type {_Fact} */ (['bad', id])) : []
                return [[], [...bad, ...e[1].flatMap(([k, x], j) => {
                    const p = params.find(([name]) => name === k)
                    return used(x, `${path}/v${j}`, env, p === undefined ? null : p[1])
                })]]
            }
            case 'block': { return [opaque, used(t[3], `${path}/b`, label_(env, [t[1], null]), null)] }
            case 'op': { return [opaque, all(t[2], path, env)] }
            case 'call': { return [opaque, all(t[3], path, env)] }
            case 'call_ref': { return [opaque, all([t[1], ...t[2]], path, env)] }
            case 'make': { return [opaque, all(t[1].map(([, x]) => x), path, env)] }
            case 'field': { return [opaque, all([t[1]], path, env)] }
            case 'variant': { return [opaque, all([t[3]], path, env)] }
            case 'trap': { return [[], []] }
            default: { return [opaque, []] }
        }
    }
    return of
}

// what to split

/** Whether a source is one of these. @type {(a: _Source, b: _Source) => boolean} */
const sameSource = (a, b) => a[0] === b[0] && (a[0] === 'opaque' || a[1] === b[1])

/** The keys of a list, as one text, to compare. @type {(keys: readonly string[]) => string} */
const keyText = keys => keys.map(k => `${k.length}:${k}`).join('')

/**
 * What to split, from a function's facts: the locals and the objects that
 * no fact keeps, removed one round at a time until none is.
 *
 * @type {(fs: readonly _Fact[]) => _Split}
 */
const solve = fs => {
    /** @type {readonly (readonly [string, readonly string[], boolean])[]} */
    const allSites = fs.flatMap(f => f[0] === 'site' ? [/** @type {const} */ ([f[1], f[2], f[3]])] : [])
    /** @type {readonly (readonly [string, string, _Source])[]} */
    const defs = fs.flatMap(f => f[0] === 'def' ? [/** @type {const} */ (['def', f[1], f[2]])] : [])
    /** @type {readonly (readonly [string, string, readonly _Source[]])[]} */
    const reads = fs.flatMap(f => f[0] === 'read' ? [/** @type {const} */ ([f[1], f[2], f[3]])] : [])
    const escaped = fs.flatMap(f => f[0] === 'escape' ? [f[1]] : [])
    const bad = fs.flatMap(f => f[0] === 'bad' ? [f[1]] : [])
    const splittable = fs.flatMap(f => f[0] === 'local' && f[2] === 'split' && !bad.includes(f[1]) ? [f[1]] : [])
    /**
     * One round: what is left after removing what a fact keeps, given the
     * locals, their keys, and the objects that are still left.
     *
     * @type {(locals: readonly (readonly [string, readonly string[]])[], sites: readonly string[]) => _Split}
     */
    const round = (locals, sites) => {
        /** @type {(s: _Source) => readonly string[] | null} */
        const keys = s => {
            if (s[0] === 'opaque') { return null }
            if (s[0] === 'site') { return sites.includes(s[1]) ? s[2] : null }
            const local = locals.find(([id]) => id === s[1])
            return local === undefined ? null : local[1]
        }
        const okReads = reads.filter(([, key, from]) => from.length > 0 && from.every(s => {
            const k = keys(s)
            return k !== null && k.includes(key) && (s[0] !== 'site' || allSites.some(([id, , pure]) => id === s[1] && pure))
        }))
        /** Whether a source is used only where it may be split. @type {(s: _Source) => boolean} */
        const kept = s => escaped.some(e => sameSource(e, s))
            || defs.some(([, target, from]) => sameSource(from, s) && !locals.some(([id]) => id === target))
            || reads.some(r => !okReads.includes(r) && r[2].some(x => sameSource(x, s)))
        const nextSites = sites.filter(id => !kept(['site', id, []]))
        const nextLocals = locals.flatMap(([id]) => {
            const from = defs.filter(([, target]) => target === id).map(([, , s]) => s)
            const ks = from.map(keys)
            const first = ks.find(k => k !== null)
            const known = ks.filter(k => k !== null)
            return from.length === 0 || first === undefined || first === null || kept(['bind', id])
                || from.some(s => s[0] === 'opaque' || (s[0] === 'site' && !sites.includes(s[1])) || (s[0] === 'bind' && !locals.some(([x]) => x === s[1])))
                || known.some(k => keyText(k) !== keyText(first))
                ? [] : [/** @type {const} */ ([id, first])]
        })
        return { locals: nextLocals, sites: nextSites, reads: okReads.map(([id]) => id) }
    }
    /** The fixed point of `round`. @type {(s: _Split) => _Split} */
    const settle = s => {
        const next = round(s.locals, s.sites)
        return next.locals.length === s.locals.length && next.sites.length === s.sites.length && next.reads.length === s.reads.length ? next : settle(next)
    }
    /** The keys of each local, from the objects that reach it, a round at a time. @type {(locals: readonly (readonly [string, readonly string[] | null])[]) => readonly (readonly [string, readonly string[] | null])[]} */
    const learn = locals => {
        const next = locals.map(([id, known]) => {
            if (known !== null) { return /** @type {const} */ ([id, known]) }
            const found = defs.filter(([, target]) => target === id).map(([, , s]) => s[0] === 'site' ? s[2]
                : s[0] === 'bind' ? locals.find(([x]) => x === s[1])?.[1] ?? null : null).find(k => k !== null)
            return /** @type {const} */ ([id, found ?? null])
        })
        return next.filter(([, k]) => k !== null).length === locals.filter(([, k]) => k !== null).length ? next : learn(next)
    }
    const learned = learn(splittable.map(id => /** @type {const} */ ([id, null])))
    const start = learned.flatMap(([id, k]) => k === null ? [] : [/** @type {const} */ ([id, k])])
    return settle({ locals: start, sites: allSites.map(([id]) => id), reads: reads.map(([id]) => id) })
}

// the rewrite

/**
 * An object that stays one, with its values in their order replaced.
 *
 * @type {(t: Term, values: readonly Term[]) => Term}
 */
const withValues = (t, values) => {
    /** @type {(b: Term, j: number) => Term} */
    const pushed = (b, j) => b[0] === 'call' && b[2] === 'push_property'
        ? ['call', 'Containers', 'push_property', [pushed(b[3][0], j - 1), b[3][1], values[Number(j - 1)]]]
        : b
    const [, sealed, arms] = /** @type {readonly ['match', readonly ['call', string, string, readonly Term[]], Match[2]]} */ (t)
    return ['match', ['call', 'Containers', 'seal', [pushed(sealed[3][0], values.length)]], arms]
}

/**
 * A function's body with what `split` says split: `rewrite` of a term at
 * `path`, whose value is read at the key `key`, or used as it is where
 * `key` is `null`. Binder claims are threaded as a list of spelling →
 * origin; a hit means an existing binder or two origins share a spelling.
 * Reads of a part do not claim.
 *
 * @typedef {readonly (readonly [string, string])[]} _Claimed
 * @typedef {readonly [_Claimed, boolean]} _ClaimSt
 *
 * @type {(get: string, split: _Split, existing: readonly string[]) => (t: Term, path: string, env: _Env, key: string | null, st: _ClaimSt) => readonly [Term, _ClaimSt]}
 */
const rewrite = (get, split, existing) => {
    /** The keys of a local that the pass splits, by its path. @type {(id: string) => readonly string[] | null} */
    const keysAt = id => split.locals.find(([x]) => x === id)?.[1] ?? null
    /** Claim `n` as a binder from `origin`, or mark a collision. @type {(st: _ClaimSt, n: string, origin: string) => _ClaimSt} */
    const claim = (st, n, origin) => {
        const [claimed, hit] = st
        if (existing.includes(n)) { return [claimed, true] }
        const prev = claimed.find(([k]) => k === n)
        if (prev !== undefined) { return prev[1] !== origin ? [claimed, true] : st }
        return [[...claimed, [n, origin]], hit]
    }
    /** The spelling of a split local's value at a key (no claim). @type {(name: string, key: string) => string} */
    const part = (name, key) => `${name}.${escape(key)}`
    /** Claim the part spelling as a binder of `(name, key)`. @type {(st: _ClaimSt, name: string, key: string) => readonly [string, _ClaimSt]} */
    const bindPart = (st, name, key) => {
        const n = part(name, key)
        return [n, claim(st, n, `${name}\u0000${key}`)]
    }
    /** @type {(t: Term, path: string, env: _Env, key: string | null, st: _ClaimSt) => readonly [Term, _ClaimSt]} */
    const go = (t, path, env, key, st) => {
        /**
         * A chain of `let`s that makes a split local's value, `prefix/` before
         * each name it binds, and what `end` makes of the value at each key
         * where the chain ends. What `end` writes stands inside the chain, whose
         * names no other name is, and reads the scope around it.
         *
         * @type {(t: Term, path: string, env: _Env, prefix: string, end: (values: readonly (readonly [string, Term])[], st: _ClaimSt) => readonly [Term, _ClaimSt], st: _ClaimSt) => readonly [Term, _ClaimSt]}
         */
        const moved = (t, path, env, prefix, end, st) => {
            if (t[0] === 'let') {
                const name = `${prefix}/${escape(t[1])}`
                // origin is prefix+name so initial and br chains of one loop share it
                const st1 = claim(st, name, `${prefix}\u0000${t[1]}`)
                const [rest, st2] = moved(t[3], `${path}/b`, bind(env, [t[1], path, name]), prefix, end, st1)
                if (keysAt(path) === null) {
                    const [value, st3] = go(t[2], `${path}/v`, env, null, st2)
                    return [['let', name, value, rest], st3]
                }
                return moved(t[2], `${path}/v`, env, name, (values, stV) => values.reduceRight(
                    (acc, [k, x]) => {
                        const [body, stB] = acc
                        const [binder, stC] = bindPart(stB, name, k)
                        return /** @type {const} */ ([['let', binder, x, body], stC])
                    },
                    /** @type {readonly [Term, _ClaimSt]} */ ([rest, stV]),
                ), st2)
            }
            const site = siteOf(t)
            if (site !== null) {
                const [values, st1] = site.reduce(
                    (acc, [k, x], j) => {
                        const [done, stA] = acc
                        const [v, stB] = go(x, `${path}/s${j}`, env, null, stA)
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([k, v])], stB])
                    },
                    /** @type {readonly [readonly (readonly [string, Term])[], _ClaimSt]} */ ([[], st]),
                )
                return end(values, st1)
            }
            // a split local, as `solve` leaves only these at the end of a chain: its parts
            const local = assertNotNullish(localOf(env, /** @type {readonly ['get', string]} */ (t)[1]))
            return end(assertNotNullish(keysAt(local[1])).map(k => /** @type {const} */ ([k, /** @type {Term} */ (['get', part(local[2], k)])])), st)
        }
        const site = siteOf(t)
        if (site !== null && key !== null) {
            const at = site.findIndex(([k]) => k === key)
            return go(site[Number(at)][1], `${path}/s${at}`, env, null, st)
        }
        if (site !== null) {
            const [values, st1] = site.reduce(
                (acc, [, x], j) => {
                    const [done, stA] = acc
                    const [v, stB] = go(x, `${path}/s${j}`, env, null, stA)
                    return /** @type {const} */ ([[...done, v], stB])
                },
                /** @type {readonly [readonly Term[], _ClaimSt]} */ ([[], st]),
            )
            return [withValues(t, values), st1]
        }
        const read = readOf(get, t)
        if (read !== null && split.reads.includes(path)) { return go(read[0], `${path}/0`, env, read[1], st) }
        switch (t[0]) {
            case 'get': {
                const local = localOf(env, t[1])
                return [local === undefined ? t : key !== null ? ['get', part(local[2], key)] : ['get', local[2]], st]
            }
            case 'let': {
                const keys = keysAt(path)
                if (keys === null) {
                    const [value, st1] = go(t[2], `${path}/v`, env, null, st)
                    // a read that is now a split local's part: the local is that part, with no copy of it
                    return value[0] === 'get' && t[2][0] !== 'get'
                        ? go(t[3], `${path}/b`, bind(env, [t[1], path, value[1]]), key, st1)
                        : (() => {
                            const [body, st2] = go(t[3], `${path}/b`, bind(env, [t[1], path, t[1]]), key, st1)
                            return /** @type {const} */ ([['let', t[1], value, body], st2])
                        })()
                }
                return moved(t[2], `${path}/v`, env, t[1], (values, stV) => {
                    const [body, stB] = go(t[3], `${path}/b`, bind(env, [t[1], path, t[1]]), key, stV)
                    return values.reduceRight(
                        (acc, [k, x]) => {
                            const [b, stA] = acc
                            const [binder, stC] = bindPart(stA, t[1], k)
                            return /** @type {const} */ ([['let', binder, x, b], stC])
                        },
                        /** @type {readonly [Term, _ClaimSt]} */ ([body, stB]),
                    )
                }, st)
            }
            case 'match': {
                const [operand, st1] = go(t[1], `${path}/e`, env, null, st)
                const [arms, st2] = t[2].reduce(
                    (acc, [variants, binder, x], j) => {
                        const [done, stA] = acc
                        const [body, stB] = go(x, `${path}/a${j}`, binder === null ? env : bind(env, [binder, `${path}/a${j}x`, binder]), key, stA)
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([variants, binder, body])], stB])
                    },
                    /** @type {readonly [Match[2], _ClaimSt]} */ ([[], st1]),
                )
                return [['match', operand, arms], st2]
            }
            case 'loop': {
                const params = t[2].map(([k], j) => /** @type {_Local} */ ([k, `${path}#${j}`, k]))
                const inner = label_(params.reduce(bind, env), [t[1], params])
                const [body, stBody] = go(t[3], `${path}/b`, inner, key, st)
                /** The loop, its split parameters' chains moved before it, from the `j`th on. @type {(j: number, env: _Env, done: readonly (readonly [string, Type, Term])[], st: _ClaimSt) => readonly [Term, _ClaimSt]} */
                const from = (j, e, done, stF) => {
                    if (j === t[2].length) { return [['loop', t[1], done, body], stF] }
                    const [k, type, first] = t[2][Number(j)]
                    const keys = keysAt(`${path}#${j}`)
                    if (keys === null) {
                        const [v, st1] = go(first, `${path}/f${j}`, e, null, stF)
                        return from(j + 1, e, [...done, [k, type, v]], st1)
                    }
                    return moved(first, `${path}/f${j}`, e, k, (values, stV) => {
                        const [params2, stP] = values.reduce(
                            (acc, [key2, x]) => {
                                const [doneP, stA] = acc
                                const [binder, stC] = bindPart(stA, k, key2)
                                return /** @type {const} */ ([[...doneP, /** @type {const} */ ([binder, any, x])], stC])
                            },
                            /** @type {readonly [readonly (readonly [string, Type, Term])[], _ClaimSt]} */ ([[], stV]),
                        )
                        return from(j + 1, e, [...done, ...params2], stP)
                    }, stF)
                }
                return from(0, env, [], stBody)
            }
            case 'br': {
                const target = env.labels.find(([k]) => k === t[1])
                const params = target === undefined ? null : target[1]
                const e = t[2]
                if (params === null || e[0] !== 'make') {
                    const [v, st1] = go(e, `${path}/v`, env, null, st)
                    return [['br', t[1], v], st1]
                }
                /** The `br`, the split parameters' chains moved before it, from the `j`th field on. @type {(j: number, env: _Env, done: readonly (readonly [string, Term])[], st: _ClaimSt) => readonly [Term, _ClaimSt]} */
                const from = (j, ee, done, stF) => {
                    if (j === e[1].length) { return [['br', t[1], ['make', done]], stF] }
                    const [k, x] = e[1][Number(j)]
                    const p = params.find(([name]) => name === k)
                    const keys = p === undefined ? null : keysAt(p[1])
                    if (keys === null) {
                        const [v, st1] = go(x, `${path}/v${j}`, ee, null, stF)
                        return from(j + 1, ee, [...done, [k, v]], st1)
                    }
                    return moved(x, `${path}/v${j}`, ee, k, (values, stV) => {
                        const [fields, stP] = values.reduce(
                            (acc, [key2, y]) => {
                                const [doneF, stA] = acc
                                const [binder, stC] = bindPart(stA, k, key2)
                                return /** @type {const} */ ([[...doneF, /** @type {const} */ ([binder, y])], stC])
                            },
                            /** @type {readonly [readonly (readonly [string, Term])[], _ClaimSt]} */ ([[], stV]),
                        )
                        return from(j + 1, ee, [...done, ...fields], stP)
                    }, stF)
                }
                return from(0, env, [], st)
            }
            case 'block': {
                const [body, st1] = go(t[3], `${path}/b`, label_(env, [t[1], null]), null, st)
                return [['block', t[1], t[2], body], st1]
            }
            case 'op': {
                const [args, st1] = t[2].reduce(
                    (acc, x, j) => {
                        const [done, stA] = acc
                        const [v, stB] = go(x, `${path}/${j}`, env, null, stA)
                        return /** @type {const} */ ([[...done, v], stB])
                    },
                    /** @type {readonly [readonly Term[], _ClaimSt]} */ ([[], st]),
                )
                return [t[3] === undefined ? ['op', t[1], args] : ['op', t[1], args, t[3]], st1]
            }
            case 'call': {
                const [args, st1] = t[3].reduce(
                    (acc, x, j) => {
                        const [done, stA] = acc
                        const [v, stB] = go(x, `${path}/${j}`, env, null, stA)
                        return /** @type {const} */ ([[...done, v], stB])
                    },
                    /** @type {readonly [readonly Term[], _ClaimSt]} */ ([[], st]),
                )
                return [['call', t[1], t[2], args], st1]
            }
            case 'call_ref': {
                const [all, st1] = [t[1], ...t[2]].reduce(
                    (acc, x, j) => {
                        const [done, stA] = acc
                        const [v, stB] = go(x, `${path}/${j}`, env, null, stA)
                        return /** @type {const} */ ([[...done, v], stB])
                    },
                    /** @type {readonly [readonly Term[], _ClaimSt]} */ ([[], st]),
                )
                const [c, ...args] = all
                return [['call_ref', c, args], st1]
            }
            case 'make': {
                const [fields, st1] = t[1].reduce(
                    (acc, [k, x], j) => {
                        const [done, stA] = acc
                        const [v, stB] = go(x, `${path}/${j}`, env, null, stA)
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([k, v])], stB])
                    },
                    /** @type {readonly [readonly (readonly [string, Term])[], _ClaimSt]} */ ([[], st]),
                )
                return [['make', fields], st1]
            }
            case 'field': {
                const [v, st1] = go(t[1], `${path}/0`, env, null, st)
                return [['field', v, t[2]], st1]
            }
            case 'variant': {
                const [v, st1] = go(t[3], `${path}/0`, env, null, st)
                return [['variant', t[1], t[2], v], st1]
            }
            default: { return [t, st] }
        }
    }
    return go
}

/**
 * A function with what it only reads back split, once: the function itself
 * where nothing is.
 *
 * @type {(get: string) => (f: Fn) => Fn}
 */
const once = get => f => {
    const existing = [...f.params.map(([k]) => k), ...binders(f.body)]
    const env = f.params.reduce((e, [k]) => bind(e, [k, `param/${k}`, k]), top)
    // what the function answers leaves it
    const [from, fs] = facts(get)(f.body, 'f', env, true)
    const params = f.params.map(([k]) => /** @type {_Fact} */ (['local', `param/${k}`, 'other']))
    const split = solve([...params, ...fs, ...from.map(s => /** @type {_Fact} */ (['escape', s]))])
    if (split.locals.length === 0 && split.reads.length === 0) { return f }
    const [body, [, hit]] = rewrite(get, split, existing)(f.body, 'f', env, null, [[], false])
    return hit ? f : { ...f, body }
}

/**
 * A function with what it only reads back split, until nothing more is:
 * an object that another holds is read back once the outer one is split.
 *
 * @type {(get: string) => (f: Fn) => Fn}
 */
const settled = get => f => {
    const g = once(get)(f)
    return g === f ? f : settled(get)(g)
}

/**
 * The records pass of a module, where `get` names L1's `get` among its
 * functions: each function's body with the objects that it only reads back
 * split into locals.
 *
 * @type {(get: string) => (m: Module) => Module}
 */
export const records = get => m => ({
    ...m,
    functions: m.functions.map(([name, f]) => /** @type {const} */ ([name, settled(get)(f)])),
})
