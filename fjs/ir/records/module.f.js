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
 *   A value that a read answers is widened to `any` with a `block` whose
 *   label is fresh in the function (`W`, or `W_` when `W` or a `br W` is
 *   open), unless it is already a `block` of full `any`. Locals and object
 *   sites are widened too: a parameter of `any.only(string)`, or a nested
 *   object of kind `object`, must not stand in for `get`, which answers
 *   `any`. A later round still finds a site under a widen `block` this
 *   pass introduced and may split it; ownership is the labels `settled`
 *   recorded from each round, not the `W`/`W_` spelling — a user-authored
 *   `block W` is never peeled, so a `br` to its label stays inside. Each
 *   wrap picks a label fresh in the function and in the term it wraps, so
 *   a nested widen (outer `if` around an inner split read) does not reopen
 *   `W` inside `W`. A plain local of full `any` (a parameter of `any`)
 *   is left as it is: it already answers what `get` would.
 * - **How it splits.** A local `s` of keys `i` and `acc` is the locals
 *   `s.i` and `s.acc`, of `any`: a `let` binds each, a loop has a
 *   parameter for each, and a `br` gives each. The `let`s of the chain that
 *   makes its value are written before, renamed `s/#1`, so that no name
 *   that the rest reads is shadowed. A key or a name in a new name has
 *   `\`, `.` and `/` escaped by a `\`, so `s.p.q` is the key `q` of
 *   `s.p` and `s.p\.q` the key `p.q` of `s`, and no new name is another. A
 *   new split name that is already a binder of the function, or that this
 *   rewrite would write twice, keeps every object of that function: cast
 *   arms like `p0.array` share the `.` spelling, escaped keys can make two
 *   origins spell the same (`r` + `x.y` and `r.x\` + `y` both write
 *   `r.x\.y`), and a loop whose initial and `br` chains both write `let t`
 *   under `s` would bind `s/t` (or `s.x` as both a `let` and a parameter)
 *   twice in nested scopes. Binders that only use those characters for kind
 *   casts do not block an unrelated split.
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

/** Whether a type is full `any` (not a subset). @type {(ty: Type) => boolean} */
const isFullAny = ty => ty[0] === 'sealed' && ty[3] === null

/**
 * A widen `block` this pass introduced: full `any`, and its label is one
 * `settled` recorded from a prior round. Label text alone is not ownership
 * — a user may author `block W`.
 *
 * @type {(widens: readonly string[], t: Term) => boolean}
 */
const isWidenBlock = (widens, t) => t[0] === 'block' && isFullAny(t[2]) && widens.includes(t[1])

/**
 * A pass-introduced widen `block`'s body, or the term itself. Does not peel
 * a user-authored block (a `br` to its label would escape).
 *
 * @type {(widens: readonly string[], t: Term) => Term}
 */
const peelWiden = (widens, t) => isWidenBlock(widens, t)
    ? peelWiden(widens, /** @type {readonly ['block', string, Type, Term]} */ (t)[3])
    : t

/**
 * The keys and the values of an object that a term builds as the lowering
 * writes one, or `null`. A pass-introduced widen `block` around a site does
 * not hide it: a later round may still split that site.
 *
 * @type {(widens: readonly string[], t: Term) => _Site | null}
 */
const siteOf = (widens, t) => {
    t = peelWiden(widens, t)
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
 * The labels a term opens or targets: `block` / `loop` declarations, and
 * `br` destinations (so a widen `block` does not capture an unresolved
 * `br W`).
 *
 * @type {(t: Term) => readonly string[]}
 */
const labelsOf = t => {
    const own = t[0] === 'block' || t[0] === 'loop' || t[0] === 'br' ? [t[1]] : []
    return [...own, ...terms(t).flatMap(labelsOf)]
}

/**
 * A label for a widen `block` that is not already open in the function, not
 * a `br` target in it, and not `return` (always in scope). Prefers `W`,
 * then `W_`, `W__`, …
 *
 * @type {(taken: readonly string[]) => string}
 */
const freshWiden = taken => {
    /** @type {(n: string) => string} */
    const next = n => taken.includes(n) ? next(`${n}_`) : n
    return next('W')
}

/**
 * A value as `get` would answer it: full `any`. A `block` of full `any` is
 * left as it is. Every other term — a local (a parameter may be
 * `any.only(string)`), an object site (kind `object`), a string literal, an
 * `if` of strings — is wrapped in a `block` of `any`, so a subset does not
 * stand in for a `get` and break a later `match` that names another kind.
 * `siteOf` still sees a site under that `block`, so a later round can split
 * it. `taken` is labels already open in the function (`return` included);
 * the wrap also avoids labels that already appear in `t`, so nesting two
 * widens in one rewrite cannot reopen the same name. A `get` of a name in
 * `fullAny` (parameters of full `any`) is not wrapped. `settled` records
 * every new label so later rounds peel only that ownership.
 *
 * @type {(taken: readonly string[], fullAny: readonly string[]) => (t: Term) => Term}
 */
const asGet = (taken, fullAny) => t => {
    if (t[0] === 'block' && isFullAny(t[2])) { return t }
    if (t[0] === 'get' && fullAny.includes(t[1])) { return t }
    return /** @type {Term} */ (['block', freshWiden([...taken, ...labelsOf(t)]), any, t])
}

/**
 * Whether the values of a loop's parameters, or of a `br` to it, may be
 * split, whose chains then move before the others: all but one of them do
 * nothing, as a local, a literal, or an object of these does nothing.
 *
 * @type {(widens: readonly string[]) => (values: readonly Term[]) => boolean}
 */
const movable = widens => values => values.filter(x => {
    const site = siteOf(widens, x)
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
 * @type {(get: string, widens: readonly string[]) => (t: Term, path: string, env: _Env, ends: boolean) => readonly [readonly _Source[], readonly _Fact[]]}
 */
const facts = (get, widens) => {
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
        const site = siteOf(widens, t)
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
                const moved = !movable(widens)(t[2].map(([, , x]) => x))
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
                const moved = !movable(widens)(e[1].map(([, x]) => x))
                /** @type {readonly _Fact[]} */
                const bad = moved ? params.map(([, id]) => /** @type {_Fact} */ (['bad', id])) : []
                return [[], [...bad, ...e[1].flatMap(([k, x], j) => {
                    const p = params.find(([name]) => name === k)
                    return used(x, `${path}/v${j}`, env, p === undefined ? null : p[1])
                })]]
            }
            case 'block': {
                // A pass-owned widen must not hide a later read's sources: after
                // round one wraps `get(#0)` as `block W: #0`, round two's
                // `get(..., "q")` still has to see the bind (and the site in
                // `#0`'s initializer). A user-authored block stays opaque.
                if (isWidenBlock(widens, t)) {
                    return of(t[3], `${path}/b`, label_(env, [t[1], null]), ends)
                }
                return [opaque, used(t[3], `${path}/b`, label_(env, [t[1], null]), null)]
            }
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
 * origin; a hit means an existing binder or a spelling this rewrite would
 * bind twice in overlapping scopes (nested `let` / loop parameter). Match
 * arms each claim from the parent state alone, so disjoint arms may share
 * a spelling. Sibling product fields and call/op arguments do the same:
 * each starts from the parent claims; only collision flags combine. A
 * non-split `let`'s body likewise starts from the parent claims: the
 * initializer's binders do not outlive it. Match arms start from the
 * parent claims (not the operand's); a loop's non-split initializers and
 * moved site fields start from the pre-loop claim state (not the body's
 * loop-part claims — those parts are not in scope in initializer
 * expressions), and sibling non-split initializers each start from that
 * state (OR hits only). A split initializer's moved chain is hoisted ahead
 * of the loop, so its binders still see the loop-part claims. A split
 * `let`'s part binders and a split loop's parameter parts are claimed
 * before the body, so an arm that would reuse an enclosing generated
 * spelling still hits. Sibling non-split `br` state fields each start
 * from the pre-field claims (OR hits only); split `br` fields still reuse
 * `part` spellings without claiming. Reads of a part do not claim.
 *
 * @typedef {readonly (readonly [string, string])[]} _Claimed
 * @typedef {readonly [_Claimed, boolean]} _ClaimSt
 *
 * @type {(get: string, split: _Split, existing: readonly string[], taken: readonly string[], widens: readonly string[], fullAny: readonly string[]) => (t: Term, path: string, env: _Env, key: string | null, st: _ClaimSt) => readonly [Term, _ClaimSt]}
 */
const rewrite = (get, split, existing, taken, widens, fullAny) => {
    /** The keys of a local that the pass splits, by its path. @type {(id: string) => readonly string[] | null} */
    const keysAt = id => split.locals.find(([x]) => x === id)?.[1] ?? null
    /** Claim `n` as a binder from `origin`, or mark a collision. A spelling
     * already claimed — even from the same origin — hits: nested scopes
     * would bind it twice (`s/t` before a loop and again on a `br`). */
    /** @type {(st: _ClaimSt, n: string, origin: string) => _ClaimSt} */
    const claim = (st, n, origin) => {
        const [claimed, hit] = st
        if (existing.includes(n) || claimed.find(([k]) => k === n) !== undefined) { return [claimed, true] }
        return [[...claimed, [n, origin]], hit]
    }
    /** The spelling of a split local's value at a key (no claim). @type {(name: string, key: string) => string} */
    const part = (name, key) => `${name}.${escape(key)}`
    /** Claim the part spelling as a binder of `(name, key)`. @type {(st: _ClaimSt, name: string, key: string) => readonly [string, _ClaimSt]} */
    const bindPart = (st, name, key) => {
        const n = part(name, key)
        return [n, claim(st, n, `${name}\u0000${key}`)]
    }
    const toAny = asGet(taken, fullAny)
    /** @type {(t: Term, path: string, env: _Env, key: string | null, st: _ClaimSt) => readonly [Term, _ClaimSt]} */
    const go = (t, path, env, key, st) => {
        /**
         * A chain of `let`s that makes a split local's value, `prefix/` before
         * each name it binds, and what `end` makes of the value at each key
         * where the chain ends. What `end` writes stands inside the chain, whose
         * names no other name is, and reads the scope around it.
         * `exprSt` is the claim list for expression-local scopes inside the
         * chain (site field values): hoisted chain binders are mirrored into
         * it, while callers may start it without binders the fields must not
         * see (loop-part claims). Defaults to `st`.
         *
         * @type {(t: Term, path: string, env: _Env, prefix: string, end: (values: readonly (readonly [string, Term])[], st: _ClaimSt) => readonly [Term, _ClaimSt], st: _ClaimSt, exprSt?: _ClaimSt) => readonly [Term, _ClaimSt]}
         */
        const moved = (t, path, env, prefix, end, st, exprSt = st) => {
            if (t[0] === 'let') {
                const name = `${prefix}/${escape(t[1])}`
                const origin = `${prefix}\u0000${t[1]}`
                // hoisted binder: claim on `st` (may include loop parts) and
                // mirror onto `exprSt` so site fields still see the chain
                const st1 = claim(st, name, origin)
                const expr1 = claim([exprSt[0], false], name, origin)
                const hit1 = st1[1] || exprSt[1] || expr1[1]
                const [rest, st2] = moved(t[3], `${path}/b`, bind(env, [t[1], path, name]), prefix, end, [st1[0], hit1], [expr1[0], hit1])
                if (keysAt(path) === null) {
                    const [value, st3] = go(t[2], `${path}/v`, env, null, st2)
                    return [['let', name, value, rest], st3]
                }
                return moved(t[2], `${path}/v`, env, name, (values, stV) => values.reduceRight(
                    (acc, [k, x]) => {
                        const [body, stB] = acc
                        const [binder, stC] = bindPart(stB, name, k)
                        return /** @type {const} */ ([['let', binder, toAny(x), body], stC])
                    },
                    /** @type {readonly [Term, _ClaimSt]} */ ([rest, stV]),
                ), st2, [expr1[0], hit1])
            }
            // a prior round may have left the site under a pass-owned widen `block`
            if (isWidenBlock(widens, t)) {
                return moved(/** @type {readonly ['block', string, Type, Term]} */ (t)[3], path, env, prefix, end, st, exprSt)
            }
            const site = siteOf(widens, t)
            if (site !== null) {
                // sibling field values: expression-local (exprSt has chain
                // binders, not loop parts); OR hits
                const [values, hit] = site.reduce(
                    (acc, [k, x], j) => {
                        const [done, hitA] = acc
                        const [v, [, hitB]] = go(x, `${path}/s${j}`, env, null, [exprSt[0], false])
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([k, v])], hitA || hitB])
                    },
                    /** @type {readonly [readonly (readonly [string, Term])[], boolean]} */ ([[], st[1]]),
                )
                return end(values, [st[0], hit])
            }
            // a split local, as `solve` leaves only these at the end of a chain: its parts
            const local = assertNotNullish(localOf(env, /** @type {readonly ['get', string]} */ (t)[1]))
            return end(assertNotNullish(keysAt(local[1])).map(k => /** @type {const} */ ([k, /** @type {Term} */ (['get', part(local[2], k)])])), st)
        }
        // Before `siteOf`: it peels pass-owned widen blocks, and a `block`
        // must keep its wrapper while its body is walked.
        if (t[0] === 'block') {
            const [body, st1] = go(t[3], `${path}/b`, label_(env, [t[1], null]), key, st)
            return [['block', t[1], t[2], body], st1]
        }
        const site = siteOf(widens, t)
        if (site !== null && key !== null) {
            const at = site.findIndex(([k]) => k === key)
            const [v, st1] = go(site[Number(at)][1], `${path}/s${at}`, env, null, st)
            return [toAny(v), st1]
        }
        if (site !== null) {
            // sibling field values: each from parent claims; OR hits
            const [values, hit] = site.reduce(
                (acc, [, x], j) => {
                    const [done, hitA] = acc
                    const [v, [, hitB]] = go(x, `${path}/s${j}`, env, null, [st[0], false])
                    return /** @type {const} */ ([[...done, v], hitA || hitB])
                },
                /** @type {readonly [readonly Term[], boolean]} */ ([[], st[1]]),
            )
            return [withValues(t, values), [st[0], hit]]
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
                            // initializer binders do not outlive the let: body
                            // starts from parent claims; OR hits only
                            const [body, [, hitB]] = go(t[3], `${path}/b`, bind(env, [t[1], path, t[1]]), key, [st[0], false])
                            return /** @type {const} */ ([['let', t[1], value, body], [st[0], st1[1] || hitB]])
                        })()
                }
                return moved(t[2], `${path}/v`, env, t[1], (values, stV) => {
                    // claim part binders before the body so a match arm that
                    // would generate the same spelling hits against them
                    const [named, stC] = values.reduce(
                        (acc, [k, x]) => {
                            const [done, stA] = acc
                            const [binder, stB] = bindPart(stA, t[1], k)
                            return /** @type {const} */ ([[...done, /** @type {const} */ ([binder, x])], stB])
                        },
                        /** @type {readonly [readonly (readonly [string, Term])[], _ClaimSt]} */ ([[], stV]),
                    )
                    const [body, stB] = go(t[3], `${path}/b`, bind(env, [t[1], path, t[1]]), key, stC)
                    return named.reduceRight(
                        (acc, [binder, x]) => {
                            const [b, stA] = acc
                            return /** @type {const} */ ([['let', binder, toAny(x), b], stA])
                        },
                        /** @type {readonly [Term, _ClaimSt]} */ ([body, stB]),
                    )
                }, st)
            }
            case 'match': {
                const [operand, [, hitOp]] = go(t[1], `${path}/e`, env, null, st)
                // each arm claims from the parent state alone: the operand's
                // binders do not outlive it, and disjoint arms may share a
                // spelling; arm claims are not merged into the continuation
                const [arms, hitArms] = t[2].reduce(
                    (acc, [variants, binder, x], j) => {
                        const [done, hit] = acc
                        const [body, [, hitBody]] = go(x, `${path}/a${j}`, binder === null ? env : bind(env, [binder, `${path}/a${j}x`, binder]), key, [st[0], false])
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([variants, binder, body])], hit || hitBody])
                    },
                    /** @type {readonly [Match[2], boolean]} */ ([[], hitOp || st[1]]),
                )
                return [['match', operand, arms], [st[0], hitArms]]
            }
            case 'loop': {
                const params = t[2].map(([k], j) => /** @type {_Local} */ ([k, `${path}#${j}`, k]))
                const inner = label_(params.reduce(bind, env), [t[1], params])
                // claim split parameter parts before the body so a match arm
                // that would generate the same spelling hits against them
                const [claimedParams, stClaim] = t[2].reduce(
                    (acc, [k], j) => {
                        const [done, stA] = acc
                        const keys = keysAt(`${path}#${j}`)
                        if (keys === null) { return /** @type {const} */ ([[...done, null], stA]) }
                        const [parts, stB] = keys.reduce(
                            (accP, key2) => {
                                const [doneP, stP] = accP
                                const [binder, stC] = bindPart(stP, k, key2)
                                return /** @type {const} */ ([[...doneP, binder], stC])
                            },
                            /** @type {readonly [readonly string[], _ClaimSt]} */ ([[], stA]),
                        )
                        return /** @type {const} */ ([[...done, parts], stB])
                    },
                    /** @type {readonly [readonly (readonly string[] | null)[], _ClaimSt]} */ ([[], st]),
                )
                const [body, [, hitBody]] = go(t[3], `${path}/b`, inner, key, stClaim)
                /** The loop, its split parameters' chains moved before it, from the `j`th on.
                 * Non-split initializers and site field values see `st` (pre-loop
                 * claims): split parameter parts are body-scope only. A split
                 * initializer's `moved` chain is hoisted ahead of the loop, so
                 * its binders use `stClaim` and still collide with loop parts;
                 * only expression-local scopes inside the chain use `st`. */
                /** @type {(j: number, env: _Env, done: readonly (readonly [string, Type, Term])[], hit: boolean) => readonly [Term, _ClaimSt]} */
                const from = (j, e, done, hit) => {
                    if (j === t[2].length) { return [['loop', t[1], done, body], [st[0], hit]] }
                    const [k, type, first] = t[2][Number(j)]
                    const keys = keysAt(`${path}#${j}`)
                    if (keys === null) {
                        const [v, [, hitV]] = go(first, `${path}/f${j}`, e, null, [st[0], false])
                        return from(j + 1, e, [...done, [k, type, v]], hit || hitV)
                    }
                    return moved(first, `${path}/f${j}`, e, k, (values, stV) => {
                        // parts already claimed for the body; reuse their spellings
                        const claimed = /** @type {readonly string[]} */ (claimedParams[Number(j)])
                        const params2 = values.map(([key2, x], i) => /** @type {const} */ ([claimed[Number(i)], any, x]))
                        return from(j + 1, e, [...done, ...params2], stV[1])
                    }, [stClaim[0], hit], [st[0], false])
                }
                const [loopTerm, [, hitInit]] = from(0, env, [], st[1])
                return [loopTerm, [st[0], hitInit || hitBody]]
            }
            case 'br': {
                const target = env.labels.find(([k]) => k === t[1])
                const params = target === undefined ? null : target[1]
                const e = t[2]
                if (params === null || e[0] !== 'make') {
                    const [v, st1] = go(e, `${path}/v`, env, null, st)
                    return [['br', t[1], v], st1]
                }
                // Sibling non-split state fields each start from the current
                // claim list (OR hits only); prior split-moved binders stay.
                /** The `br`, the split parameters' chains moved before it, from the `j`th field on. @type {(j: number, env: _Env, done: readonly (readonly [string, Term])[], st: _ClaimSt) => readonly [Term, _ClaimSt]} */
                const from = (j, ee, done, stF) => {
                    if (j === e[1].length) { return [['br', t[1], ['make', done]], stF] }
                    const [k, x] = e[1][Number(j)]
                    const p = params.find(([name]) => name === k)
                    const keys = p === undefined ? null : keysAt(p[1])
                    if (keys === null) {
                        const [v, [, hitV]] = go(x, `${path}/v${j}`, ee, null, [stF[0], false])
                        return from(j + 1, ee, [...done, [k, v]], [stF[0], stF[1] || hitV])
                    }
                    return moved(x, `${path}/v${j}`, ee, k, (values, stV) => {
                        // field names match the loop parameters already claimed
                        const fields = values.map(([key2, y]) => /** @type {const} */ ([part(k, key2), y]))
                        return from(j + 1, ee, [...done, ...fields], stV)
                    }, stF)
                }
                return from(0, env, [], st)
            }
            case 'op': {
                // sibling args: each from parent claims; OR hits
                const [args, hit] = t[2].reduce(
                    (acc, x, j) => {
                        const [done, hitA] = acc
                        const [v, [, hitB]] = go(x, `${path}/${j}`, env, null, [st[0], false])
                        return /** @type {const} */ ([[...done, v], hitA || hitB])
                    },
                    /** @type {readonly [readonly Term[], boolean]} */ ([[], st[1]]),
                )
                return [t[3] === undefined ? ['op', t[1], args] : ['op', t[1], args, t[3]], [st[0], hit]]
            }
            case 'call': {
                // sibling args: each from parent claims; OR hits
                const [args, hit] = t[3].reduce(
                    (acc, x, j) => {
                        const [done, hitA] = acc
                        const [v, [, hitB]] = go(x, `${path}/${j}`, env, null, [st[0], false])
                        return /** @type {const} */ ([[...done, v], hitA || hitB])
                    },
                    /** @type {readonly [readonly Term[], boolean]} */ ([[], st[1]]),
                )
                return [['call', t[1], t[2], args], [st[0], hit]]
            }
            case 'call_ref': {
                // callee and args are sibling expressions
                const [all, hit] = [t[1], ...t[2]].reduce(
                    (acc, x, j) => {
                        const [done, hitA] = acc
                        const [v, [, hitB]] = go(x, `${path}/${j}`, env, null, [st[0], false])
                        return /** @type {const} */ ([[...done, v], hitA || hitB])
                    },
                    /** @type {readonly [readonly Term[], boolean]} */ ([[], st[1]]),
                )
                const [c, ...args] = all
                return [['call_ref', c, args], [st[0], hit]]
            }
            case 'make': {
                // sibling product fields: each from parent claims; OR hits
                const [fields, hit] = t[1].reduce(
                    (acc, [k, x], j) => {
                        const [done, hitA] = acc
                        const [v, [, hitB]] = go(x, `${path}/${j}`, env, null, [st[0], false])
                        return /** @type {const} */ ([[...done, /** @type {const} */ ([k, v])], hitA || hitB])
                    },
                    /** @type {readonly [readonly (readonly [string, Term])[], boolean]} */ ([[], st[1]]),
                )
                return [['make', fields], [st[0], hit]]
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
 * where nothing is. `widens` are labels prior rounds of `settled` introduced
 * — only those blocks may be peeled to find a site.
 *
 * @type {(get: string, widens: readonly string[]) => (f: Fn) => Fn}
 */
const once = (get, widens) => f => {
    const existing = [...f.params.map(([k]) => k), ...binders(f.body)]
    // `return` is always open; each wrap also avoids labels inside its term
    const taken = [...labelsOf(f.body), 'return']
    // parameters of full `any` already answer get; do not wrap their gets
    const fullAny = f.params.filter(([, ty]) => isFullAny(ty)).map(([k]) => k)
    const env = f.params.reduce((e, [k]) => bind(e, [k, `param/${k}`, k]), top)
    // what the function answers leaves it
    const [from, fs] = facts(get, widens)(f.body, 'f', env, true)
    const params = f.params.map(([k]) => /** @type {_Fact} */ (['local', `param/${k}`, 'other']))
    const split = solve([...params, ...fs, ...from.map(s => /** @type {_Fact} */ (['escape', s]))])
    if (split.locals.length === 0 && split.reads.length === 0) { return f }
    const [body, [, hit]] = rewrite(get, split, existing, taken, widens, fullAny)(f.body, 'f', env, null, [[], false])
    return hit ? f : { ...f, body }
}

/**
 * A function with what it only reads back split, until nothing more is:
 * an object that another holds is read back once the outer one is split.
 * Labels that appear in the body only after a round are owned by the pass
 * for later peels (a round may introduce several when widens nest).
 *
 * @type {(get: string) => (f: Fn) => Fn}
 */
const settled = get => {
    /** @type {(f: Fn, widens: readonly string[]) => Fn} */
    const go = (f, widens) => {
        const next = once(get, widens)(f)
        if (next === f) { return f }
        const before = labelsOf(f.body)
        const introduced = labelsOf(next.body).filter((l, i, all) => !before.includes(l) && all.indexOf(l) === i)
        return go(next, [...widens, ...introduced])
    }
    return f => go(f, [])
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
