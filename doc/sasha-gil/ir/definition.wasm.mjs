// @ts-nocheck
// A prototype of the WASM emitter of doc/sasha-gil/ir/definition.md, for a
// module in import form: every function of an imported interface is a WASM
// import, and a sealed type is its carrier. It answers a module of
// fjs/media/wasm's AST, which that folder's writers turn into bytes and
// into WAT.
//
// A block has at most one result here, so a product crosses a label only
// as a loop's parameters. It accompanies definition.ir.mjs.

import { isNot, refuse, show } from './definition.ir.mjs'

const two = n => 1n << BigInt(n)
/** The word that holds an integer range, and whether it is read as signed. */
const carrier = t =>
    t[1] >= -two(31) && t[2] < two(31) ? { bits: 32, signed: true }
    : t[1] >= 0n && t[2] < two(32) ? { bits: 32, signed: false }
    : t[1] >= -two(63) && t[2] < two(63) ? { bits: 64, signed: true }
    : t[1] >= 0n && t[2] < two(64) ? { bits: 64, signed: false }
    : refuse(`${show(t)} needs two words`)
const bitsOf = x => { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x); return view.getBigUint64(0) }

/**
 * `checked` is the owned stage of a module as `check` answers it, and
 * `exports` names the functions to export. The module also exports `init`,
 * which evaluates the constants, and its memory and table for the host.
 */
export const emit = (checked, exports) => {
    const { module, type, decl, isNever, isBool, isFloat, sigOf } = checked
    const ifaces = module.imports

    const flat = t => {
        switch (t[0]) {
            case 'int': return [`i${carrier(t).bits}`]
            case 'f64': case 'f64c': return ['f64']
            case 'sum': return isNever(t) ? [] : ['i32']
            case 'sealed': return [decl(t).carrier]
            case 'product': return Object.values(t[1]).flatMap(flat)
            case 'code': return ['i32']
            default: return refuse(`no carrier for ${show(t)}`)
        }
    }
    const toCarrier = (from, to) => {
        const a = carrier(from)
        return a.bits === to.bits ? [] : a.bits === 32 ? [[a.signed ? 'i64.extend_i32_s' : 'i64.extend_i32_u']] : [['i32.wrap_i64']]
    }
    /** A value that is on the stack as a `from`, where a `to` is wanted. */
    const coerce = (from, to) => {
        if (isNever(from)) { return [] }
        if (from[0] === 'int' && to[0] === 'int') { return toCarrier(from, carrier(to)) }
        flat(from).join() === flat(to).join() || refuse(`a ${show(from)} where a ${show(to)} is wanted`)
        return []
    }
    const blockType = t => { const f = flat(t); return f.length === 0 ? null : f.length === 1 ? f[0] : refuse('a block with two results') }
    /** A constant is one global here, so its type is one word. */
    const word = (t, what) => { const f = flat(t); return f.length === 1 ? f[0] : refuse(`${what} is ${show(t)}, and this prototype holds a constant in one global`) }
    const constantWords = new Map(Object.entries(module.constants).map(([name, [x]]) => [name, word(x, `constant ${name}`)]))
    Object.hasOwn(module.functions, 'init') && refuse('`init` is the function that evaluates the constants, so no function has that name')

    // what the module imports and holds, found while its code is emitted
    const fnImports = new Map()
    const globalImports = new Map()
    const literals = new Map()
    const codes = []
    /** An import is declared once, so every use of it has one type. It answers the import's key. */
    const declare = (imports, entry) => {
        const key = JSON.stringify([entry.module, entry.name])
        const known = imports.get(key)
        known === undefined || JSON.stringify(known.type) === JSON.stringify(entry.type) || refuse(`${entry.module} ${entry.name} is imported with two types`)
        imports.set(key, entry)
        return key
    }
    const importFn = (m, name) => {
        const s = sigOf(m, name)
        return { fn: declare(fnImports, { module: ifaces[m].abi, name: s.abi ?? name, type: {
            params: s.params.flatMap(([, , x]) => flat(x)),
            results: s.returns === undefined ? flat(s.result) : [],
        } }) }
    }
    const importRaw = (abi, name, params, results) => ({ fn: declare(fnImports, { module: abi, name, type: { params, results } }) })

    const emitFunction = (name, params, result, build) => {
        const paramTypes = params.flatMap(([, , x]) => flat(x))
        const locals = []
        const localNames = []
        const frames = []
        // a name that the emitter makes may repeat, and the name section wants each once
        const used = new Map(params.map(([k]) => [k, 1]))
        const unique = as => { const count = (used.get(as) ?? 0) + 1; used.set(as, count); return count === 1 ? as : `${as}.${count}` }
        const alloc = (t, as) => {
            const name = unique(as)
            return flat(t).map((vt, k, all) => {
                locals.push(vt)
                const index = paramTypes.length + locals.length - 1
                localNames.push([index, all.length === 1 ? name : `${name}.${k}`])
                return index
            })
        }
        let next = 0
        const vars = new Map(params.map(([k, , x]) => [k, {
            type: x,
            slots: flat(x).map((_, j, all) => { localNames.push([next, all.length === 1 ? k : `${k}.${j}`]); return next++ }),
        }]))
        const set = slots => [...slots].reverse().map(s => ['local.set', s])
        const framed = (frame, f) => { frames.push(frame); const r = f(); frames.pop(); return r }
        const depth = label => frames.length - 1 - frames.findLastIndex(frame => frame.label === label)

        /** The instructions of a term, and the type its value has on the stack. */
        const term = (t, env) => {
            const as = (x, wanted, e = env) => { const [code, actual] = term(x, e); return [...code, ...coerce(actual, wanted)] }
            const never = code => isNever(type(t)) ? [...code, ['unreachable']] : code
            switch (t[0]) {
                case 'lit': {
                    const [, x, value] = t
                    if (x[0] === 'int') { return [[carrier(x).bits === 32 ? ['i32.const', Number(BigInt.asIntN(32, value))] : ['i64.const', BigInt.asIntN(64, value)]], x] }
                    if (x[0] === 'f64c') { return [[['f64.const', bitsOf(value)]], x] }
                    // a literal of a sealed type is made by the function that its interface names
                    typeof value === 'string' || refuse('this prototype makes a literal from the units of a string only')
                    literals.set(value, null)
                    const maker = decl(x).literal[x[3].join()]
                    return [[['i32.const', { ptr: value }], ['i32.const', value.length], ['call', importRaw(ifaces[maker.module].abi, maker.name, ['i32', 'i32'], [decl(x).carrier])]], x]
                }
                case 'get': { const v = env.get(t[1]); return [v.slots.map(s => ['local.get', s]), v.type] }
                case 'let': {
                    const [e, actual] = term(t[2], env)
                    const bound = type(t[2])
                    if (isNever(bound)) { return [e, bound] }
                    if (t[1] === null) { const [body, bodyType] = term(t[3], env); return [[...e, ...flat(actual).map(() => ['drop']), ...body], bodyType] }
                    const slots = alloc(bound, t[1])
                    const [body, bodyType] = term(t[3], new Map(env).set(t[1], { type: bound, slots }))
                    return [[...e, ...coerce(actual, bound), ...set(slots), ...body], bodyType]
                }
                case 'op': {
                    if (t[1] === 'trunc_sat') {
                        const c = carrier(t[2])
                        return [[...term(t[3], env)[0], [`i${c.bits}.trunc_sat_f64_${c.signed ? 's' : 'u'}`]], t[2]]
                    }
                    const args = t.slice(2).map(x => term(x, env))
                    if (t[1] === 'float') { const c = carrier(args[0][1]); return [[...args[0][0], [`f64.convert_i${c.bits}_${c.signed ? 's' : 'u'}`]], type(t)] }
                    if (isFloat(args[0][1])) { return [[...args.flatMap(([code]) => code), [`f64.${t[1]}`]], type(t)] }
                    // an exact result in the word that holds it, a comparison in the word that holds both sides
                    const word = carrier(['add', 'sub', 'mul'].includes(t[1]) ? type(t)
                        : ['int', args.map(([, x]) => x[1]).reduce((a, b) => a < b ? a : b), args.map(([, x]) => x[2]).reduce((a, b) => a > b ? a : b)])
                    const name = ['lt', 'le'].includes(t[1]) ? `${t[1]}_${word.signed ? 's' : 'u'}` : t[1]
                    return [[...args.flatMap(([code, actual]) => [...code, ...toCarrier(actual, word)]), [`i${word.bits}.${name}`]], type(t)]
                }
                case 'call': {
                    const s = sigOf(t[1], t[2])
                    let kept = null
                    const args = t.slice(3).flatMap((x, k) => {
                        const code = as(x, s.params[k][2])
                        if (s.returns !== k) { return code }
                        // an owned value that the function gives back is passed once, and read again after the call
                        if (x[0] === 'get') { kept = env.get(x[1]).slots; return code }
                        kept = alloc(s.params[k][2], `${t[2]}.kept`)
                        return [...code, ...set(kept), ...kept.map(slot => ['local.get', slot])]
                    })
                    const target = t[1] === 'self' ? { self: t[2] } : importFn(t[1], t[2])
                    return [never([...args, ['call', target], ...(kept ?? []).map(slot => ['local.get', slot])]), type(t)]
                }
                case 'constant': {
                    if (t[1] === 'self') { return [[['global.get', { constant: t[2] }]], type(t)] }
                    // a constant of an interface is an imported global
                    const key = declare(globalImports, { module: ifaces[t[1]].abi, name: t[2], type: word(type(t), `constant ${t[1]}.${t[2]}`) })
                    return [[['global.get', { global: key }]], type(t)]
                }
                case 'code': { if (!codes.includes(t[1])) { codes.push(t[1]) } return [[['i32.const', { code: t[1] }]], type(t)] }
                case 'make': return [Object.entries(t[1]).flatMap(([k, x]) => as(x, type(t)[1][k])), type(t)]
                case 'field': {
                    t[1][0] === 'get' || refuse('this prototype reads a field of a local only')
                    const v = env.get(t[1][1])
                    const keys = Object.keys(v.type[1])
                    const before = keys.slice(0, keys.indexOf(t[2])).flatMap(k => flat(v.type[1][k])).length
                    return [v.slots.slice(before, before + flat(v.type[1][t[2]]).length).map(s => ['local.get', s]), v.type[1][t[2]]]
                }
                case 'variant': return [[['i32.const', Object.keys(t[1][1]).indexOf(t[2])]], t[1]]
                case 'match': {
                    const result = type(t)
                    const operand = type(t[1])
                    // a sealed sum may name its variants `true` and `false` as well, and it is no `bool`
                    if (isBool(operand) && isNot(t)) { return [[...as(t[1], operand), ['i32.eqz']], result] }
                    if (isBool(operand)) {
                        const arm = v => t[2].find(([variants]) => variants === null || variants.includes(v))[2]
                        return [never([...as(t[1], operand), ['if', blockType(result)],
                            ...framed({}, () => [...as(arm('true'), result), ['else'], ...as(arm('false'), result)]), ['end']]), result]
                    }
                    // a sealed sum: the module's `kind`, and a branch
                    const { variants: tags, kind } = decl(operand)
                    // a local is matched where it is, and a tag that is read once stays on the stack
                    const here = t[1][0] === 'get'
                    const value = here ? env.get(t[1][1]).slots : alloc(operand, 'm')
                    const tests = t[2].flatMap(([variants]) => variants ?? []).length
                    const tag = tests === 1 ? null : alloc(['int', 0n, BigInt(tags.length - 1)], 'k')[0]
                    const readTag = [...value.map(s => ['local.get', s]), ['call', importFn(operand[1], kind)]]
                    const chain = k => {
                        if (k === t[2].length) { return [['unreachable']] }
                        const [variants, binder, body] = t[2][k]
                        const inner = binder === null ? env : new Map(env).set(binder, { type: operand, slots: value })
                        if (variants === null) { return as(body, result, inner) }
                        const test = variants.flatMap((v, j) => [...(tag === null ? readTag : [['local.get', tag]]), ['i32.const', tags.indexOf(v)], ['i32.eq'], ...(j === 0 ? [] : [['i32.or']])])
                        return [...test, ['if', blockType(result)], ...framed({}, () => [...as(body, result, inner), ['else'], ...chain(k + 1)]), ['end']]
                    }
                    return [never([
                        ...(here ? [] : [...as(t[1], operand), ...set(value)]),
                        ...(tag === null ? [] : [...readTag, ['local.set', tag]]),
                        ...chain(0),
                    ]), result]
                }
                case 'block': return [never([['block', blockType(t[2])], ...framed({ label: t[1], type: t[2] }, () => as(t[3], t[2])), ['end']]), t[2]]
                case 'loop': {
                    let inner = env
                    const first = Object.entries(t[2]).flatMap(([k, [x, e]]) => {
                        const code = as(e, x)
                        const slots = alloc(x, k)
                        inner = new Map(inner).set(k, { type: x, slots })
                        return [...code, ...set(slots)]
                    })
                    const params = Object.keys(t[2]).map(k => inner.get(k))
                    const result = type(t)
                    return [never([...first, ['loop', blockType(result)], ...framed({ label: t[1], params }, () => as(t[3], result, inner)), ['end']]), result]
                }
                case 'br': {
                    const frame = frames.findLast(f => f.label === t[1])
                    // a label that no region here has is `return`, the label of the function's body
                    if (frame === undefined) { return [[...as(t[2], result), ['return']], type(t)] }
                    if (frame.params === undefined) { return [[...as(t[2], frame.type), ['br', depth(t[1])]], type(t)] }
                    // every next value, then all the parameters at once
                    const values = Object.values(t[2][1]).flatMap((x, k) => as(x, frame.params[k].type))
                    return [[...values, ...set(frame.params.flatMap(p => p.slots)), ['br', depth(t[1])]], type(t)]
                }
                case 'trap': return [[['unreachable']], type(t)]
                default: return refuse(`no WASM for ${t[0]}`)
            }
        }
        const body = build((t, wanted) => { const [code, actual] = term(t, vars); return [...code, ...coerce(actual, wanted)] })
        return { name, type: { params: paramTypes, results: flat(result) }, locals, localNames, body }
    }

    const defined = [
        ...Object.entries(module.functions).map(([name, f]) => emitFunction(name, f.params, f.result, as => as(f.body, f.result))),
        // `init` evaluates the constants in their order, once
        emitFunction('init', [], ['product', {}], as => Object.entries(module.constants).flatMap(([name, [x, e]]) => [...as(e, x), ['global.set', { constant: name }]])),
    ]

    // indices, now that every import is known
    const imports = [
        ...[...fnImports.values()].map(({ module: m, name, type: t }) => ({ module: m, name, type: t })),
    ]
    const types = []
    const typeIndex = t => {
        const key = JSON.stringify(t)
        const at = types.findIndex(x => JSON.stringify(x) === key)
        return at >= 0 ? at : types.push(t) - 1
    }
    // imports come first, and what the module defines has names of its own
    const fnIndex = new Map([...fnImports.keys()].map((key, k) => [key, k]))
    const definedIndex = new Map(defined.map((f, k) => [f.name, fnImports.size + k]))
    const globalIndex = new Map([...globalImports.keys()].map((key, k) => [key, k]))
    const constantIndex = new Map(Object.keys(module.constants).map((name, k) => [name, globalImports.size + k]))
    let dataEnd = 0
    for (const value of literals.keys()) { literals.set(value, dataEnd); dataEnd += 2 * value.length }
    const resolve = instruction => instruction.map(x => typeof x !== 'object' || x === null ? x
        : x.fn !== undefined ? fnIndex.get(x.fn)
        : x.self !== undefined ? definedIndex.get(x.self)
        : x.constant !== undefined ? constantIndex.get(x.constant)
        : x.global !== undefined ? globalIndex.get(x.global)
        : x.code !== undefined ? codes.indexOf(x.code)
        : x.ptr !== undefined ? literals.get(x.ptr)
        : x)
    const groups = locals => locals.reduce((acc, vt) => acc.length > 0 && acc[acc.length - 1][1] === vt
        ? [...acc.slice(0, -1), [acc[acc.length - 1][0] + 1, vt]] : [...acc, [1, vt]], [])
    const importTypes = imports.map(x => typeIndex(x.type))
    const definedTypes = defined.map(f => typeIndex(f.type))
    const zero = vt => vt === 'i32' ? [['i32.const', 0]] : vt === 'i64' ? [['i64.const', 0n]] : [['f64.const', 0n]]
    return {
        types,
        imports: [
            ...imports.map((x, k) => ({ module: x.module, name: x.name, desc: ['func', importTypes[k]] })),
            ...[...globalImports.values()].map(g => ({ module: g.module, name: g.name, desc: ['global', { type: g.type, mutable: false }] })),
        ],
        functions: defined.map((f, k) => ({ type: definedTypes[k], locals: groups(f.locals), body: f.body.map(resolve) })),
        tables: [{ element: 'funcref', limits: { min: codes.length, max: codes.length } }],
        // 64 KiB pages that hold the literals' units
        memories: [{ min: Math.max(1, Math.ceil(dataEnd / 0x1_0000)), max: null }],
        globals: [...constantWords.values()].map(vt => ({ type: { type: vt, mutable: true }, init: zero(vt) })),
        exports: [
            ...exports.map(name => ({ name, kind: 'func', index: definedIndex.get(name) ?? refuse(`no function ${name} to export`) })),
            { name: 'init', kind: 'func', index: definedIndex.get('init') },
            { name: 'memory', kind: 'memory', index: 0 },
            { name: 'table', kind: 'table', index: 0 },
        ],
        start: null,
        elements: codes.length === 0 ? [] : [{ mode: ['active', 0, [['i32.const', 0]]], init: ['func', codes.map(name => definedIndex.get(name))] }],
        dataCount: null,
        data: dataEnd === 0 ? [] : [{
            mode: ['active', 0, [['i32.const', 0]]],
            bytes: [...literals.keys()].flatMap(value => Array.from({ length: value.length }, (_, k) => value.charCodeAt(k)).flatMap(unit => [unit & 0xff, unit >> 8])),
        }],
        customs: [{
            after: 'data',
            content: ['name', [
                ['function', [...[...fnImports.values()].map((x, k) => [k, x.name]), ...defined.map((f, k) => [fnImports.size + k, f.name])]],
                ['local', defined.map((f, k) => [fnImports.size + k, [...f.localNames].sort((a, b) => a[0] - b[0])])],
                ['global', [...[...globalImports.values()].map((g, k) => [k, g.name]), ...Object.keys(module.constants).map((name, k) => [globalImports.size + k, name])]],
            ]],
        }],
    }
}
