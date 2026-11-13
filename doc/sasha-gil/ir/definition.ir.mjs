// @ts-nocheck
// A prototype of the core of the code IR, as doc/sasha-gil/ir/definition.md
// shapes it: types and terms as data, interfaces, the checker and a printer.
//
// A module is built with the constructors below. The checker checks what
// they can build, and data of another shape is not its input.
//
// It is not the IR. It covers the part that program code and the L1 bodies
// need, which is the part with no memory in it: integer ranges of one
// word, floats, `bool`, products, sealed types of imported interfaces and
// code values, with every term form of the definition except `call_ref`,
// a `match` on an integer and a sum of its own other than `bool`. Declared
// bits, heap objects and references are the other prototype's,
// nan-box-in-ir.edsl.mjs. The tsconfig checks every .mjs, and this file is
// plain JavaScript without types, so it opts out above.

/** What the checker refuses: a mistake in a module, never a run-time event. */
export class Refused extends Error {}
export const refuse = message => { throw new Refused(message) }

// ── Types, as data ───────────────────────────────────────────────────────

export const int = (lo, hi) => lo > hi ? refuse(`int(${lo}, ${hi}) is empty`) : ['int', lo, hi]
export const u = n => int(0n, (1n << BigInt(n)) - 1n)
export const i = n => int(-(1n << BigInt(n - 1)), (1n << BigInt(n - 1)) - 1n)
export const f64 = ['f64']
export const f64c = ['f64c']
export const product = fields => ['product', fields]
export const unit = product({})
export const sum = variants => ['sum', variants]
export const bool = sum({ false: unit, true: unit })
export const never = sum({})
/** A type that a module exports without its definition. */
export const sealed = (module, name) => ['sealed', module, name, null]
/** Some of the public variants of a sealed sum. */
export const only = (type, ...variants) => ['sealed', type[1], type[2], variants]
/** A pointer to a top-level function. `params` is a list of `[mode, type]`. */
export const code = (params, result) => ['code', params, result]
/** Marks a parameter that the callee consumes. */
export const own = type => ({ own: type })

const isNever = t => t[0] === 'sum' && Object.keys(t[1]).length === 0
const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'
const same = (a, b) => a === b || (a instanceof Array && b instanceof Array
    ? a.length === b.length && a.every((x, k) => same(x, b[k]))
    : typeof a === 'object' && typeof b === 'object' && a !== null && b !== null
        ? same(Object.entries(a), Object.entries(b))
        : false)
/** A sum is `bool` only when its variants are `false` and `true`, in that order, and hold nothing. */
const isBool = t => same(t, bool)
const min = (a, b) => a < b ? a : b
const max = (a, b) => a > b ? a : b
const fits64 = t => (t[1] >= -(1n << 63n) && t[2] < 1n << 63n) || (t[1] >= 0n && t[2] < 1n << 64n)
    ? t : refuse(`${show(t)} needs more than 64 bits, which this prototype leaves out`)

// ── Interfaces and signatures ────────────────────────────────────────────

/**
 * A function's signature. A parameter borrows unless it is `own(T)`.
 * `fails` is the one effect. `abi` renames the import, and `returns: k`
 * says that the result is parameter `k`, an owned value that the function
 * consumes and gives back, which an import passes once and does not return.
 * The options are read by name: a pattern in the parameter list would go
 * into the declaration that TypeScript writes for this file, with a type
 * that has `fails` only.
 */
export const sig = (params, result, options = {}) => ({
    params: Object.entries(params).map(([name, t]) => t.own !== undefined ? [name, 'own', t.own] : [name, 'borrow', t]),
    result, fails: options.fails ?? false, abi: options.abi, returns: options.returns,
})

/**
 * What a module shows to its importers: sealed types, constants and
 * function signatures. `abi` is the WASM import module of its import form.
 */
export const iface = (name, { abi, types = {}, constants = {}, functions = {} }) => ({ name, abi, types, constants, functions })

// ── Terms, as data ───────────────────────────────────────────────────────

export const lit = (type, value) => ['lit', type, value]
/** An integer literal has the type of its value alone. */
export const n = value => lit(int(value, value), value)
export const get = name => ['get', name]
/** `body` is a term, or a function of the bound local. */
export const let_ = (name, e, body) => ['let', name, e, typeof body === 'function' ? body(get(name)) : body]
const op = name => (...args) => ['op', name, ...args]
export const add = op('add')
export const sub = op('sub')
export const mul = op('mul')
export const div = op('div')
export const eq = op('eq')
export const lt = op('lt')
export const le = op('le')
/** An integer within ±2^53 as the float of the same value. */
export const float = op('float')
/** The low level's truncation of a float: saturating, and 0 for a NaN. */
export const truncSat = (type, e) => ['op', 'trunc_sat', type, e]
export const call = (module, name) => (...args) => ['call', module, name, ...args]
export const constant = (module, name) => ['constant', module, name]
export const codeOf = name => ['code', name]
export const make = fields => ['make', fields]
export const field = (e, name) => ['field', e, name]
export const true_ = ['variant', bool, 'true']
export const false_ = ['variant', bool, 'false']
/** `arms` is a list of `[variants, binder, body]`; `variants` is `null` for `else`. */
export const match = (e, arms) => ['match', e, arms]
export const block = (label, type, body) => ['block', label, type, body]
/** `params` maps a name to `[type, first value]`. */
export const loop = (label, params, body) =>
    ['loop', label, params, typeof body === 'function' ? body(Object.fromEntries(Object.keys(params).map(k => [k, get(k)]))) : body]
/** To a block: leave it with a value. To a loop: repeat it with the next parameters. */
export const br = (label, e) => ['br', label, e]
export const trap = reason => ['trap', reason]
/** The checked way down to a subtype: a range of a wider range, or some variants of a sum. */
export const narrow = (type, e) => ['narrow', type, e]
/** The integer that has the value of a float, or a trap: no rounding. */
export const exact = (type, e) => ['exact', type, e]

// What the definition derives instead of having: none of these is a term form.
export const if_ = (c, a, b) => match(c, [[['true'], null, a], [['false'], null, b]])
export const not = b => if_(b, false_, true_)
export const ne = (a, b) => not(eq(a, b))
export const return_ = e => br('return', e)
export const seq = (e, body) => let_(null, e, body)
/**
 * A cast as a statement, with the rest of the scope in its arm: `name` is
 * `e` at the narrower `type` there. A `match` lends its operand to its
 * arms, so no copy is made.
 */
export const cast = (type, e, name, body) => match(e, [
    [type[3], name, typeof body === 'function' ? body(get(name)) : body],
    [null, null, trap(`not ${type[3].join(' or ')}`)],
])

// ── Printing ─────────────────────────────────────────────────────────────

export const show = t => {
    switch (t[0]) {
        case 'int': {
            if (t[1] === t[2]) { return `${t[1]}` }
            const bits = t[2].toString(2).length
            if (t[1] === 0n && t[2] === (1n << BigInt(bits)) - 1n) { return `u(${bits})` }
            if (t[1] < 0n && t[1] === -(t[2] + 1n)) { return `i(${bits + 1})` }
            return `int(${t[1]}, ${t[2]})`
        }
        case 'f64': case 'f64c': return t[0]
        case 'product': return Object.keys(t[1]).length === 0 ? 'unit' : `{ ${Object.entries(t[1]).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} }`
        case 'sum': return isNever(t) ? 'never' : isBool(t) ? 'bool' : `sum({ ${Object.entries(t[1]).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} })`
        case 'sealed': return t[3] === null ? t[2] : `${t[2]}.only(${t[3].join(', ')})`
        case 'code': return `code([${t[1].map(([mode, x]) => mode === 'own' ? `own ${show(x)}` : show(x)).join(', ')}], ${show(t[2])})`
        default: return refuse(`not a type: ${t}`)
    }
}

const showLit = value => typeof value === 'string' ? `'${value}'` : typeof value === 'bigint' ? `${value}` : Object.is(value, -0) ? '-0.0' : Number.isInteger(value) ? `${value}.0` : `${value}`
const callee = (module, name) => module === 'self' ? name : `${module}.${name}`
/** A term on one line, or `null` when a part of it needs lines of its own. */
const flatTerm = t => {
    const wrap = (head, xs, first = '') => {
        const f = xs.map(flatTerm)
        return f.includes(null) ? null : `${head}(${first}${f.join(', ')})`
    }
    const one = (x, text) => { const f = flatTerm(x); return f === null ? null : text(f) }
    switch (t[0]) {
        case 'lit': return showLit(t[2])
        case 'get': return t[1]
        case 'op': return t[1] === 'trunc_sat' ? wrap('trunc_sat', [t[3]], `${show(t[2])}, `) : wrap(t[1], t.slice(2))
        case 'call': return wrap(callee(t[1], t[2]), t.slice(3))
        case 'constant': return callee(t[1], t[2])
        case 'code': return `code(${t[1]})`
        case 'make': {
            const f = Object.entries(t[1]).map(([k, x]) => [k, flatTerm(x)])
            return f.some(([, x]) => x === null) ? null : `{ ${f.map(([k, x]) => `${k}: ${x}`).join(', ')} }`
        }
        case 'field': return one(t[1], f => `${f}.${t[2]}`)
        case 'variant': return t[2]
        case 'br': return one(t[2], f => t[1] === 'return' ? `return ${f}` : `br ${t[1]} ${f}`)
        case 'trap': return `trap('${t[1]}')`
        case 'narrow': case 'exact': return wrap(t[0], [t[2]], `${show(t[1])}, `)
        case 'match': {
            if (isNot(t)) { return wrap('not', [t[1]]) }
            if (!isIf(t)) { return null }
            // a short `if` reads best on one line
            const f = [t[1], t[2][0][2], t[2][1][2]].map(flatTerm)
            const text = `if ${f[0]} then ${f[1]} else ${f[2]}`
            return f.includes(null) || text.length > 64 ? null : text
        }
        default: return null
    }
}
const isIf = t => t[0] === 'match' && t[2].length === 2 && same(t[2][0][0], ['true']) && same(t[2][1][0], ['false'])
const isVariant = (t, name) => t[0] === 'variant' && t[2] === name
/** `not(b)` is `if b then false else true`, and it is printed, and emitted, as what it is. */
export const isNot = t => isIf(t) && isVariant(t[2][0][2], 'false') && isVariant(t[2][1][2], 'true')
/** A term as indented lines of text, the way a review would read it. */
const lines = (t, pad) => {
    const flat = flatTerm(t)
    if (flat !== null) { return [`${pad}${flat}`] }
    const inner = `${pad}    `
    // a term after a keyword: on the same line when it is one line
    const after = (head, x) => { const f = flatTerm(x); return f !== null ? [`${pad}${head} ${f}`] : [`${pad}${head}`, ...lines(x, inner)] }
    const spread = (head, xs) => [`${pad}${head}`, ...xs.flatMap((x, k) => {
        const ls = lines(x, inner)
        return [...ls.slice(0, -1), `${ls.at(-1)}${k < xs.length - 1 ? ',' : ')'}`]
    })]
    switch (t[0]) {
        case 'let': {
            const f = flatTerm(t[2])
            const head = t[1] === null ? '' : `let ${t[1]} = `
            const first = f !== null ? [`${pad}${head}${f}`] : [`${pad}${head.trimEnd()}`, ...lines(t[2], inner)]
            return [...first, ...lines(t[3], pad)]
        }
        case 'match': {
            if (isNot(t)) { return spread('not(', [t[1]]) }
            if (isIf(t)) {
                // an `if` in the `else` goes on with the chain at the same depth
                const other = t[2][1][2]
                const rest = isIf(other) && !isNot(other) && flatTerm(other) === null
                    ? lines(other, pad).map((l, k) => k === 0 ? `${pad}else ${l.trimStart()}` : l)
                    : [`${pad}else`, ...lines(other, inner)]
                return [...after('if', t[1]).map((l, k) => k === 0 && flatTerm(t[1]) !== null ? `${l} then` : l),
                    ...(flatTerm(t[1]) !== null ? [] : [`${pad}then`]), ...lines(t[2][0][2], inner), ...rest]
            }
            return [...after('match', t[1]), ...t[2].flatMap(([variants, binder, body]) => {
                const head = `${pad}  ${variants === null ? 'else' : variants.join(' | ')}${binder === null ? '' : ` as ${binder}`} =>`
                const f = flatTerm(body)
                return f !== null && head.length + f.length < 96 ? [`${head} ${f}`] : [head, ...lines(body, inner)]
            })]
        }
        case 'block': return [`${pad}block ${t[1]}: ${show(t[2])}`, ...lines(t[3], inner)]
        // an application with an argument that needs lines of its own: one argument per group of lines
        case 'op': return t[1] === 'trunc_sat' ? spread(`trunc_sat(${show(t[2])},`, [t[3]]) : spread(`${t[1]}(`, t.slice(2))
        case 'call': return spread(`${callee(t[1], t[2])}(`, t.slice(3))
        case 'narrow': case 'exact': return spread(`${t[0]}(${show(t[1])},`, [t[2]])
        case 'make': return spread('make(', Object.values(t[1]))
        case 'field': return [...spread('(', [t[1]]).slice(0, -1), `${spread('(', [t[1]]).at(-1)}.${t[2]}`]
        case 'br': return after(t[1] === 'return' ? 'return' : `br ${t[1]}`, t[2])
        case 'loop': return [`${pad}loop ${t[1]} (${Object.entries(t[2]).map(([k, [type, first]]) => `${k}: ${show(type)} = ${flatTerm(first) ?? '…'}`).join(', ')})`, ...lines(t[3], inner)]
        default: return refuse(`not a term: ${t[0]}`)
    }
}
const showParams = params => params.map(([name, mode, type]) => `${mode === 'own' ? 'own ' : ''}${name}: ${show(type)}`).join(', ')
/** A module's constants and functions as text. */
export const print = (module, names = Object.keys(module.functions)) => [
    ...Object.entries(module.constants ?? {}).flatMap(([name, [type, e]]) => [`const ${name}: ${show(type)} =`, ...lines(e, '    '), '']),
    ...names.flatMap(name => {
        const f = module.functions[name]
        return [`fn ${name}(${showParams(f.params)}) -> ${show(f.result)} =`, ...lines(f.body, '    '), '']
    }),
].join('\n')

// ── The checker ──────────────────────────────────────────────────────────

/** A function of a module, written with the signature's parameter form. */
export const fn = (params, result, body) => {
    const s = sig(params, result)
    return { params: s.params, result, body: typeof body === 'function' ? body(Object.fromEntries(s.params.map(([k]) => [k, get(k)]))) : body }
}

/**
 * Checks a module and answers it again with every term rebuilt, so that no
 * two places share a term, and the type of each term in `type`. It also
 * writes out `narrow` and `exact`, makes a constant of each literal that a
 * module has to build, and infers the one effect of each function.
 */
export const check = module => {
    const ifaces = module.imports
    Object.hasOwn(ifaces, 'self') && refuse('`self` is the module itself, so no import has that name')
    const types = new Map()
    const decl = t => ifaces[t[1]]?.types[t[2]] ?? refuse(`no sealed type ${t[1]}.${t[2]}`)
    /** The variants that a value of a sealed sum may have. */
    const variantsOf = t => t[3] ?? decl(t).variants
    /** Variants in the order of their tags, and fields checked. */
    const normal = t => {
        switch (t[0]) {
            case 'sealed': {
                const { variants } = decl(t)
                if (variants === undefined) { return t[3] === null ? t : refuse(`${t[2]} has no public variants`) }
                const wanted = t[3] ?? variants
                wanted.forEach(v => variants.includes(v) || refuse(`${t[2]} has no variant ${v}`))
                // the whole sum is written without a list
                const kept = variants.filter(v => wanted.includes(v))
                return ['sealed', t[1], t[2], kept.length === variants.length ? null : kept]
            }
            case 'product': return product(Object.fromEntries(Object.entries(t[1]).map(([k, x]) => [k, normal(x)])))
            case 'code': return code(t[1].map(([mode, x]) => [mode, normal(x)]), normal(t[2]))
            // every type that a module writes comes through here, so no value is carried as a tag without its fields
            case 'sum': return isNever(t) || isBool(t) ? t : refuse(`${show(t)}: this prototype has no sum of its own but bool`)
            default: return t
        }
    }
    const sub = (a, b) => {
        if (isNever(a)) { return true }
        if (a[0] !== b[0]) { return a[0] === 'f64c' && b[0] === 'f64' }
        switch (a[0]) {
            case 'int': return b[1] <= a[1] && a[2] <= b[2]
            case 'sealed': return a[1] === b[1] && a[2] === b[2] && (b[3] === null || (a[3] !== null && a[3].every(v => b[3].includes(v))))
            case 'product': return same(Object.keys(a[1]), Object.keys(b[1])) && Object.keys(a[1]).every(k => sub(a[1][k], b[1][k]))
            default: return same(a, b)
        }
    }
    const join = (a, b) => sub(a, b) ? b : sub(b, a) ? a
        : a[0] === 'int' && b[0] === 'int' ? int(min(a[1], b[1]), max(a[2], b[2]))
        : a[0] === 'sealed' && b[0] === 'sealed' && a[1] === b[1] && a[2] === b[2] ? normal(only(a, ...variantsOf(a), ...variantsOf(b)))
        : refuse(`${show(a)} and ${show(b)} have no common type`)
    const expect = (what, actual, wanted) => sub(actual, wanted) || refuse(`${what}: ${show(actual)} is not ${show(wanted)}`)

    const signature = (m, name) => m === 'self'
        ? (module.functions[name] ?? refuse(`no function ${name}`))
        : (ifaces[m]?.functions[name] ?? refuse(`no function ${m}.${name}`))
    const sigOf = (m, name) => {
        const s = signature(m, name)
        const params = s.params.map(([k, mode, t]) => [k, mode, normal(t)])
        const result = normal(s.result)
        // with `returns: k` the result is parameter `k` itself, so that one is owned and has the result's type
        const back = params[s.returns]
        s.returns === undefined || (Number.isInteger(s.returns) && back?.[1] === 'own' && same(back[2], result))
            || refuse(`${callee(m, name)}: \`returns\` has to name an owned parameter that has the type of the result`)
        return { ...s, params, result }
    }
    const failing = new Map(Object.keys(module.functions).map(k => [k, false]))
    /** The constants of the module that a function may read, itself or through a function it names. */
    const reading = new Map(Object.keys(module.functions).map(k => [k, new Set()]))
    /** The literals of sealed types that functions hold, as constants under their spelling. */
    const literals = new Map()
    const fresh = (() => { let k = 0; return () => `$${++k}` })()

    /** A comparison of a local with a range narrows the local in each branch. */
    const refine = (cond, truth, env) => {
        if (cond[0] !== 'op' || !['lt', 'le', 'eq'].includes(cond[1])) { return env }
        const [, cmp, a, b] = cond
        const ta = types.get(a)
        const tb = types.get(b)
        if (ta[0] !== 'int' || tb[0] !== 'int') { return env }
        const locals = new Map(env.locals)
        const narrowTo = (term, lo, hi) => {
            if (term[0] !== 'get') { return }
            const t = locals.get(term[1])
            const l = max(t[1], lo)
            const h = min(t[2], hi)
            if (l <= h) { locals.set(term[1], int(l, h)) }
        }
        const far = 1n << 200n
        if (cmp === 'lt' && truth) { narrowTo(a, -far, tb[2] - 1n); narrowTo(b, ta[1] + 1n, far) }
        if (cmp === 'lt' && !truth) { narrowTo(a, tb[1], far); narrowTo(b, -far, ta[2]) }
        if (cmp === 'le' && truth) { narrowTo(a, -far, tb[2]); narrowTo(b, ta[1], far) }
        if (cmp === 'le' && !truth) { narrowTo(a, tb[1] + 1n, far); narrowTo(b, -far, ta[2] - 1n) }
        if (cmp === 'eq' && truth) { narrowTo(a, tb[1], tb[2]); narrowTo(b, ta[1], ta[2]) }
        if (cmp === 'eq' && !truth) {
            // a local loses a value only at an end of its range
            const drop = (term, other) => {
                if (term[0] !== 'get' || other[1] !== other[2]) { return }
                const t = locals.get(term[1])
                if (t[1] === other[1]) { narrowTo(term, t[1] + 1n, far) }
                if (t[2] === other[1]) { narrowTo(term, -far, t[2] - 1n) }
            }
            drop(a, tb)
            drop(b, ta)
        }
        return { ...env, locals }
    }

    /** `narrow(T, e)` written out: a test, and a trap in the other branch. */
    const expand = (target, e, from) => {
        const x = fresh()
        if (from[0] === 'sealed' && target[0] === 'sealed') {
            sub(target, from) || refuse(`narrow: ${show(target)} is not part of ${show(from)}`)
            return match(e, [[variantsOf(target), x, get(x)], [null, null, trap(`not ${variantsOf(target).join(' or ')}`)]])
        }
        if (from[0] === 'int' && target[0] === 'int') {
            return let_(x, e, v => {
                const high = from[2] > target[2] ? if_(lt(n(target[2]), v), trap('out of range'), v) : v
                return from[1] < target[1] ? if_(lt(v, n(target[1])), trap('out of range'), high) : high
            })
        }
        return refuse(`narrow: from ${show(from)} to ${show(target)}`)
    }
    /** `exact(T, e)` written out: truncate, convert back, compare. */
    const expandExact = (target, e, from) => {
        isFloat(from) && target[0] === 'int' || refuse(`exact: from ${show(from)} to ${show(target)}`)
        const carrier = target[1] >= -(1n << 31n) && target[2] < 1n << 31n ? i(32) : refuse('exact: this prototype has 32 bits only')
        const [x, y] = [fresh(), fresh()]
        return let_(x, e, v => let_(y, truncSat(carrier, v), k =>
            if_(eq(float(k), v), narrow(target, k), trap('not an integer'))))
    }

    const ck = (t, env) => {
        const done = (term, type) => { types.set(term, type); return term }
        switch (t[0]) {
            case 'lit': {
                const type = normal(t[1])
                if (type[0] === 'int') { typeof t[2] === 'bigint' && type[1] <= t[2] && t[2] <= type[2] || refuse(`${t[2]} is not ${show(type)}`) }
                else if (type[0] === 'f64c') { typeof t[2] === 'number' || refuse(`${t[2]} is not a float`) }
                else if (type[0] === 'sealed') {
                    decl(type).literal?.[variantsOf(type)?.join()] !== undefined || refuse(`${show(type)} has no literals`)
                    // a literal that its module has to make is a constant, made once
                    if (env.lift) {
                        const name = showLit(t[2])
                        // a literal's constant is named by its spelling, so a spelling has one type
                        const known = literals.get(name)?.[0]
                        known === undefined || same(known, type)
                            || refuse(`the literal ${name} is made as ${known[1]}.${show(known)} and as ${type[1]}.${show(type)}, and this prototype names a literal by its spelling`)
                        literals.set(name, [type, ['lit', type, t[2]]])
                        return done(['constant', 'self', name], type)
                    }
                }
                else { refuse(`no literal of ${show(type)}`) }
                return done(['lit', type, t[2]], type)
            }
            case 'get': return done(['get', t[1]], env.locals.get(t[1]) ?? refuse(`no local ${t[1]}`))
            case 'let': {
                const e = ck(t[2], env)
                const type = types.get(e)
                if (t[1] === null) {
                    same(type, unit) || isNever(type) || refuse(`a term used only for its effect has type ${show(type)}`)
                    const body = ck(t[3], env)
                    return done(['let', null, e, body], isNever(type) ? never : types.get(body))
                }
                env.locals.has(t[1]) && refuse(`${t[1]} is bound twice`)
                const body = ck(t[3], { ...env, locals: new Map(env.locals).set(t[1], type) })
                return done(['let', t[1], e, body], isNever(type) ? never : types.get(body))
            }
            case 'op': {
                if (t[1] === 'trunc_sat') {
                    const e = ck(t[3], env)
                    isFloat(types.get(e)) || refuse('trunc_sat takes a float')
                    ;[i(32), u(32), i(64), u(64)].some(c => same(c, t[2])) || refuse('trunc_sat answers a whole word')
                    return done(['op', 'trunc_sat', t[2], e], t[2])
                }
                const args = t.slice(2).map(x => ck(x, env))
                const arity = t[1] === 'float' ? 1 : 2
                args.length === arity || refuse(`${t[1]} takes ${arity === 1 ? 'one operand' : 'two operands'}`)
                const [a, b] = args.map(x => types.get(x))
                const ints = args.every(x => types.get(x)[0] === 'int')
                const floats = args.every(x => isFloat(types.get(x)))
                const type = (() => {
                    switch (t[1]) {
                        case 'add': return ints ? fits64(int(a[1] + b[1], a[2] + b[2])) : floats ? f64 : null
                        case 'sub': return ints ? fits64(int(a[1] - b[2], a[2] - b[1])) : floats ? f64 : null
                        case 'mul': {
                            if (floats) { return f64 }
                            if (!ints) { return null }
                            const p = [a[1] * b[1], a[1] * b[2], a[2] * b[1], a[2] * b[2]]
                            return fits64(int(p.reduce(min), p.reduce(max)))
                        }
                        case 'div': return floats ? f64 : null
                        case 'eq': case 'lt': case 'le': return ints ? (fits64(int(min(a[1], b[1]), max(a[2], b[2]))), bool) : floats ? bool : null
                        case 'float': return ints && a[1] >= -(1n << 53n) && a[2] <= 1n << 53n ? f64c : null
                        default: return null
                    }
                })()
                return done(['op', t[1], ...args], type ?? refuse(`${t[1]} of ${args.map(x => show(types.get(x))).join(' and ')}`))
            }
            case 'call': {
                const s = sigOf(t[1], t[2])
                const args = t.slice(3).map(x => ck(x, env))
                args.length === s.params.length || refuse(`${callee(t[1], t[2])} takes ${s.params.length} arguments`)
                args.forEach((x, k) => expect(`${callee(t[1], t[2])}, argument ${s.params[k][0]}`, types.get(x), s.params[k][2]))
                if (t[1] === 'self' ? failing.get(t[2]) : s.fails) { env.fails.yes = true }
                if (t[1] === 'self') { reading.get(t[2]).forEach(c => env.reads.add(c)) }
                // a `dup` answers the type of its argument, so a refined value stays refined
                const isDup = Object.values(ifaces[t[1]]?.types ?? {}).some(d => d.dup === t[2])
                return done(['call', t[1], t[2], ...args], isDup ? types.get(args[0]) : s.result)
            }
            case 'constant': {
                const type = t[1] === 'self' ? (literals.get(t[2]) ?? module.constants?.[t[2]])?.[0] : ifaces[t[1]]?.constants[t[2]]
                if (t[1] === 'self') { env.reads.add(t[2]) }
                return done(['constant', t[1], t[2]], normal(type ?? refuse(`no constant ${callee(t[1], t[2])}`)))
            }
            case 'code': {
                const s = sigOf('self', t[1])
                // whoever holds the value may call it
                reading.get(t[1]).forEach(c => env.reads.add(c))
                return done(['code', t[1]], code(s.params.map(([, mode, x]) => [mode, x]), s.result))
            }
            case 'make': {
                const fields = Object.fromEntries(Object.entries(t[1]).map(([k, x]) => [k, ck(x, env)]))
                return done(['make', fields], product(Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, types.get(x)]))))
            }
            case 'field': {
                const e = ck(t[1], env)
                const type = types.get(e)
                return done(['field', e, t[2]], type[0] === 'product' && type[1][t[2]] !== undefined ? type[1][t[2]] : refuse(`${show(type)} has no field ${t[2]}`))
            }
            case 'variant': return done(['variant', t[1], t[2]], isBool(t[1]) && t[1][1][t[2]] !== undefined ? t[1] : refuse('this prototype has no sum but bool'))
            case 'match': {
                const e = ck(t[1], env)
                const type = types.get(e)
                const all = isBool(type) ? ['false', 'true'] : type[0] === 'sealed' && decl(type).variants !== undefined ? variantsOf(type)
                    : refuse(`match on ${show(type)}`)
                let left = all
                const arms = t[2].map(([variants, binder, body]) => {
                    const mine = variants ?? left
                    variants?.length === 0 && refuse('match: an arm names no variant')
                    variants?.forEach(v => left.includes(v) || refuse(`match: ${v} is not a variant of the operand that is still open`))
                    left = left.filter(v => !mine.includes(v))
                    const refined = isBool(type) ? type : normal(['sealed', type[1], type[2], all.filter(v => mine.includes(v))])
                    binder !== null && env.locals.has(binder) && refuse(`${binder} is bound twice`)
                    let inner = binder === null ? env : { ...env, locals: new Map(env.locals).set(binder, refined) }
                    if (isBool(type) && mine.length === 1) { inner = refine(e, mine[0] === 'true', inner) }
                    return [variants, binder, ck(body, inner)]
                })
                left.length === 0 || refuse(`match: no arm for ${left.join(', ')}`)
                return done(['match', e, arms], arms.map(([, , body]) => types.get(body)).reduce(join, never))
            }
            case 'block': {
                const type = normal(t[2])
                env.labels.has(t[1]) && refuse(`label ${t[1]} is used twice`)
                const body = ck(t[3], { ...env, labels: new Map(env.labels).set(t[1], { kind: 'block', type }) })
                expect(`block ${t[1]}`, types.get(body), type)
                return done(['block', t[1], type, body], type)
            }
            case 'loop': {
                env.labels.has(t[1]) && refuse(`label ${t[1]} is used twice`)
                const params = Object.fromEntries(Object.entries(t[2]).map(([k, [type, first]]) => {
                    const e = ck(first, env)
                    expect(`loop ${t[1]}, parameter ${k}`, types.get(e), normal(type))
                    return [k, [normal(type), e]]
                }))
                const locals = new Map(env.locals)
                Object.entries(params).forEach(([k, [type]]) => locals.has(k) ? refuse(`${k} is bound twice`) : locals.set(k, type))
                const body = ck(t[3], { ...env, locals, labels: new Map(env.labels).set(t[1], { kind: 'loop', params }) })
                return done(['loop', t[1], params, body], types.get(body))
            }
            case 'br': {
                const label = env.labels.get(t[1]) ?? refuse(`no label ${t[1]}`)
                const e = ck(t[2], env)
                if (label.kind === 'loop') {
                    e[0] === 'make' && same(Object.keys(e[1]), Object.keys(label.params)) || refuse(`br ${t[1]} gives the loop's parameters, in order`)
                    Object.entries(label.params).forEach(([k, [type]]) => expect(`br ${t[1]}, parameter ${k}`, types.get(e[1][k]), type))
                } else {
                    expect(`br ${t[1]}`, types.get(e), label.type)
                }
                return done(['br', t[1], e], never)
            }
            case 'trap': env.fails.yes = true; return done(['trap', t[1]], never)
            case 'narrow': case 'exact': {
                const from = types.get(ck(t[2], env))
                return ck((t[0] === 'narrow' ? expand : expandExact)(normal(t[1]), t[2], from), env)
            }
            default: return refuse(`not a term: ${t[0]}`)
        }
    }

    const constants = {}
    const checkConstants = () => Object.entries(module.constants ?? {}).forEach(([name, [type, e]]) => {
        const reads = new Set()
        // a constant whose whole term is a literal is that literal's constant
        const body = ck(e, { locals: new Map(), labels: new Map(), fails: {}, reads, lift: e[0] !== 'lit' })
        expect(`constant ${name}`, types.get(body), normal(type))
        // `init` evaluates the constants in their order, and the literals before them
        reads.forEach(c => Object.hasOwn(constants, c) || literals.has(c) || refuse(`constant ${name} reads ${c} before ${c} is evaluated`))
        constants[name] = [normal(type), body]
    })
    const functions = {}
    const checkFunctions = () => Object.entries(module.functions).forEach(([name, f]) => {
        const s = sigOf('self', name)
        const fails = { yes: false }
        const reads = new Set()
        const locals = new Map(s.params.map(([k, , type]) => [k, type]))
        const body = ck(f.body, { locals, labels: new Map([['return', { kind: 'block', type: s.result }]]), fails, reads, lift: true })
        expect(`function ${name}`, types.get(body), s.result)
        functions[name] = { params: s.params, result: s.result, body, fails: fails.yes, reads }
    })
    // the one effect, and the constants that a function reads: checked again until no function changes
    for (;;) {
        checkFunctions()
        const changed = Object.entries(functions).filter(([name, f]) => f.fails !== failing.get(name) || f.reads.size !== reading.get(name).size)
        if (changed.length === 0) { break }
        changed.forEach(([name, f]) => { failing.set(name, f.fails); reading.set(name, f.reads) })
    }
    checkConstants()
    const ownership = t => {
        switch (t[0]) {
            case 'sealed': {
                const d = decl(t)
                // a subset whose every variant holds nothing to release is copy
                if (t[3] !== null && t[3].every(v => (d.copy ?? []).includes(v))) { return 'copy' }
                // the rest is which of `dup` and `drop` the interface names
                return d.dup !== undefined ? 'counted' : d.drop !== undefined ? 'unique' : 'linear'
            }
            case 'product': {
                // the strictest field decides
                const kinds = Object.values(t[1]).map(ownership)
                return ['linear', 'unique', 'counted'].find(kind => kinds.includes(kind)) ?? 'copy'
            }
            default: return 'copy'
        }
    }
    // a literal is a constant under its spelling, so no other constant has that name
    literals.forEach((_, name) => Object.hasOwn(constants, name) && refuse(`a constant is named ${name}, which is the spelling of a literal`))
    return {
        // a literal comes first: a constant after it may read it, or call a function that does
        module: { ...module, constants: { ...Object.fromEntries(literals), ...constants }, functions },
        type: term => types.get(term) ?? refuse('a term without a type'),
        ownership, decl, isNever, isBool, isFloat, sub, sigOf,
    }
}
