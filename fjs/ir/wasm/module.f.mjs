/**
 * The emitter: a module that the [checker](../check/module.f.mjs) took, as a
 * WebAssembly module in the AST of [`fjs/media/wasm`](../../media/wasm/types.ts),
 * whose [writer](../../media/wasm/binary/write/module.f.mjs) makes its bytes.
 *
 * It reads the types that the checker answered, and they alone decide what it
 * writes:
 *
 * - **A value is one WASM value, or none.** A range is an `i32` where it fits
 *   32 bits and an `i64` where it does not, unsigned where it holds no
 *   negative integer and two's complement where it does. A float is an
 *   `f64`, and a `bool` an `i32`, `0` for `false` and `1` for `true`. `unit`
 *   and `never` are no value.
 * - **Integer arithmetic is the word's, and exact.** `add`, `sub` and `mul`
 *   run in the wider of the words of their operands and their result, and
 *   wrap to 32 bits where the result's word is narrower. A word's arithmetic
 *   is modulo its size, and the checker's range of the result fits the
 *   result's word, so the bits are those of the exact result.
 * - **A comparison runs in the word that [`compareIn`](../module.f.mjs)
 *   picks**, signed where an operand may be negative.
 * - **A value widens where it meets a wider type**: where it is an operand,
 *   an argument or the value of a `br`, and where an arm or a body meets its
 *   `match`, `block` or function. An `i32` that stands for a value of an
 *   `i64` range is extended by its own signedness, and a literal is written
 *   in the wider word.
 * - **A sealed type is its carrier**, the WASM value that its interface
 *   names: `any` is an `i64`. A function of an interface is an import of
 *   the interface's `abi` by the function's name, so the functions that
 *   share a name, as the four `length`s do, share the host's function too.
 *   Imports come first, an interface at a time.
 * - **A `match` of a `bool` is an `if`**, a `block` is a `block`, and a `br`
 *   is a `br`, or a `return` to the label `return`. Where a `match`, a
 *   `block` or a `call` is `never`, an `unreachable` follows it, so that the
 *   code after it validates: WASM knows that nothing follows a `br`, and
 *   not that nothing follows these.
 * - **A `match` of a sealed type asks its interface for the tag**, through
 *   the function that the type names as its `kind`, once, and tests it with
 *   an `if` for each arm but the last, which takes the variants that no arm
 *   before it took. An arm's name for the operand is the operand's local.
 * - **A `trap` is an `unreachable`.**
 *
 * The functions keep their order and their names, which the name section
 * holds with their parameters and the locals of their `let`s, and an import
 * is named for its interface and its function: `String.length`.
 *
 * @module
 *
 * @import { BlockType, Expr, FuncType, Instruction, Locals, Module as WasmModule, ValType } from '../../media/wasm/types.ts'
 * @import { Checked, Int, Interface, OpName, Sealed, SealedDef, Signature, Type, Typed } from '../types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { _Callee, _Code, _Env } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { bitsOf } from '../../media/rust/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { compareIn, equal, fits, i, never, u } from '../module.f.mjs'

// values

/** A sealed type's definition in the interface that names it, which the checker found. @type {(interfaces: OrderedMap<Interface>, t: Sealed) => SealedDef} */
const definition = (interfaces, [, module, name]) =>
    assertNotNullish(assertNotNullish(at(module)(interfaces)).types.find(([k]) => k === name))[1]

/**
 * The WASM values that hold a value of `t`: one, or none for `unit` and
 * `never`. A sealed type's is the one its interface names.
 *
 * @type {(interfaces: OrderedMap<Interface>, t: Type) => readonly ValType[]}
 */
const carrier = (interfaces, t) =>
    t[0] === 'int' ? [fits(32)(t) ? 'i32' : 'i64']
    : t[0] === 'f64' || t[0] === 'f64c' ? ['f64']
    : t[0] === 'sum' && t[1].length > 0 ? ['i32']
    : t[0] === 'sealed' ? [definition(interfaces, t).carrier]
    : []

/** @type {(env: _Env, t: Type) => BlockType} */
const blockType = (env, t) => {
    const c = carrier(env.interfaces, t)
    return c.length === 0 ? null : c[0]
}

/** The bits of a range's word. @type {(t: Int) => 32 | 64} */
const width = t => fits(32)(t) ? 32 : 64

/** Whether a range's word is read as two's complement. @type {(t: Int) => boolean} */
const signed = t => t[1] < 0n

/** An integer as the immediate of a `const` of `bits`: its bits, read as two's complement. @type {(bits: 32 | 64) => (v: bigint) => bigint} */
const immediate = bits => v => v >= 1n << BigInt(bits - 1) ? v - (1n << BigInt(bits)) : v

/** @type {(type: Type, v: bigint | number) => Instruction} */
const literal = (type, v) =>
    typeof v === 'number' ? ['f64.const', bitsOf(v)]
    : type[0] === 'int' && width(type) === 32 ? ['i32.const', Number(immediate(32)(v))]
    : ['i64.const', immediate(64)(v)]

/** What makes a value of `from` one of `to`, a type that holds it: an `i32` is extended by its signedness. @type {(from: Type, to: Type) => Expr} */
const widen = (from, to) =>
    from[0] === 'int' && to[0] === 'int' && width(from) < width(to) ? [signed(from) ? ['i64.extend_i32_s'] : ['i64.extend_i32_u']] : []

/** The range of a word of `bits` that holds a range, read as the range is. @type {(t: Int, bits: 32 | 64) => Int} */
const word = (t, bits) => bits === 32 ? t : signed(t) ? i(64) : u(64)

/** @type {(t: Type) => Expr} */
const afterNever = t => equal(t, never) ? [['unreachable']] : []

// operators

/** @type {(name: OpName, bits: 32 | 64, isSigned: boolean) => Instruction} */
const integer = (name, bits, isSigned) => {
    const i32 = bits === 32
    switch (name) {
        case 'add': { return i32 ? ['i32.add'] : ['i64.add'] }
        case 'sub': { return i32 ? ['i32.sub'] : ['i64.sub'] }
        case 'mul': { return i32 ? ['i32.mul'] : ['i64.mul'] }
        case 'eq': { return i32 ? ['i32.eq'] : ['i64.eq'] }
        case 'lt': { return i32 ? (isSigned ? ['i32.lt_s'] : ['i32.lt_u']) : isSigned ? ['i64.lt_s'] : ['i64.lt_u'] }
        default: { return i32 ? (isSigned ? ['i32.le_s'] : ['i32.le_u']) : isSigned ? ['i64.le_s'] : ['i64.le_u'] }
    }
}

/** @type {(name: OpName) => Instruction} */
const float = name => {
    switch (name) {
        case 'add': { return ['f64.add'] }
        case 'sub': { return ['f64.sub'] }
        case 'mul': { return ['f64.mul'] }
        case 'div': { return ['f64.div'] }
        case 'neg': { return ['f64.neg'] }
        case 'abs': { return ['f64.abs'] }
        case 'sqrt': { return ['f64.sqrt'] }
        case 'eq': { return ['f64.eq'] }
        case 'lt': { return ['f64.lt'] }
        default: { return ['f64.le'] }
    }
}

/**
 * The float of an integer, exact within ±2^53, where the signed and the
 * unsigned conversion of an `i64` agree: the one written is still the one
 * that reads the word as the range is.
 *
 * @type {(t: Int) => Instruction}
 */
const convert = t => width(t) === 32
    ? (signed(t) ? ['f64.convert_i32_s'] : ['f64.convert_i32_u'])
    : signed(t) ? ['f64.convert_i64_s'] : ['f64.convert_i64_u']

/**
 * An operator: its operands, each made a value of the word that it runs in,
 * then its instruction, and a wrap where its result's word is narrower.
 *
 * @type {(env: _Env, type: Type, name: OpName, args: readonly Typed[]) => _Code}
 */
const operator = (env, type, name, args) => {
    const ints = args.flatMap(([t]) => t[0] === 'int' ? [t] : [])
    const own = args.map(x => /** @type {const} */ ([x, x[0]]))
    if (ints.length === 0) { return sequence(env, own, [float(name)]) }
    if (name === 'float') { return sequence(env, own, [convert(ints[0])]) }
    /** The operands as values of `bits`. @type {(bits: 32 | 64) => readonly (readonly [Typed, Type])[]} */
    const inWord = bits => args.map((x, k) => [x, word(ints[k], bits)])
    if (name === 'eq' || name === 'lt' || name === 'le') {
        const { bits, signed: isSigned } = assertNotNullish(compareIn(ints[0], ints[1]))
        return sequence(env, inWord(bits), [integer(name, bits, isSigned)])
    }
    const words = [type, ...ints].map(t => carrier(env.interfaces, t)[0])
    const bits = words.includes('i64') ? 64 : 32
    /** @type {Expr} */
    const wrap = bits === 64 && words[0] === 'i32' ? [['i32.wrap_i64']] : []
    return sequence(env, inWord(bits), [integer(name, bits, false), ...wrap])
}

// terms

/** @type {(code: Expr) => _Code} */
const just = code => ({ code, locals: [] })

/**
 * A term as a value of `to`, a type that holds the term's: a literal is
 * written in `to`'s word, and any other term is widened to it. Its locals
 * come after `taken` more.
 *
 * @type {(env: _Env, taken: number, x: Typed, to: Type) => _Code}
 */
const valueOf = (env, taken, [type, t], to) => {
    if (t[0] === 'lit') { return just([literal(to, t[2])]) }
    const c = term({ ...env, next: env.next + taken }, [type, t])
    return { code: [...c.code, ...widen(type, to)], locals: c.locals }
}

/**
 * Terms in their order, each as a value of the type beside it, then
 * `after`. Each term's locals follow those of the terms before it.
 *
 * @type {(env: _Env, parts: readonly (readonly [Typed, Type])[], after: Expr) => _Code}
 */
const sequence = (env, parts, after) => {
    const all = parts.reduce((done, [x, to]) => {
        const c = valueOf(env, done.locals.length, x, to)
        return { code: [...done.code, ...c.code], locals: [...done.locals, ...c.locals] }
    }, just([]))
    return { code: [...all.code, ...after], locals: all.locals }
}

/** @type {(env: _Env) => _Env} */
const deeper = env => ({ ...env, depth: env.depth + 1 })

/**
 * A `match` of a sealed type. A `get` is read from its local, and any other
 * operand is kept in one, named `match`, which the arms' names read. Where
 * the arms test more than one variant, the tag is read once, into a local
 * named for the operand: `v.kind`.
 *
 * @type {(env: _Env, type: Type, operand: Typed, arms: readonly (readonly [readonly string[], string | null, Typed])[]) => _Code}
 */
const sealedMatch = (env, type, operand, arms) => {
    const [of, x] = operand
    const sealed = /** @type {Sealed} */ (of)
    const { variants, kind } = definition(env.interfaces, sealed)
    const [kindIndex] = assertNotNullish(at(kind)(assertNotNullish(at(sealed[1])(env.imports))))
    const here = x[0] === 'get' ? assertNotNullish(at(x[1])(env.locals)) : null
    const c = here === null ? term(env, operand) : just([])
    const named = x[0] === 'get' ? x[1] : 'match'
    /** @type {_Code['locals']} */
    const kept = here === null ? [[named, carrier(env.interfaces, of)[0]]] : []
    const slot = here ?? env.next + c.locals.length
    const tests = arms.slice(0, -1).flatMap(([vs]) => vs).length
    /** @type {_Code['locals']} */
    const tagged = tests > 1 ? [[`${named}.kind`, 'i32']] : []
    const tagSlot = env.next + c.locals.length + kept.length
    /** @type {Expr} */
    const readTag = [['local.get', slot], ['call', kindIndex]]
    /** @type {Expr} */
    const tag = tests > 1 ? [['local.get', tagSlot]] : readTag
    /** The arms from the `k`th on, as an `if` that tests the `k`th, whose `else` holds the rest. @type {(inner: _Env, k: number, taken: number) => _Code} */
    const chain = (inner, k, taken) => {
        const [vs, binder, body] = arms[k]
        const scoped = binder === null ? inner : { ...inner, locals: setReplace(binder)(slot)(inner.locals) }
        if (k === arms.length - 1) { return valueOf(scoped, taken, body, type) }
        /** @type {Expr} */
        const test = vs.flatMap((v, j) => [...tag, ['i32.const', variants.indexOf(v)], ['i32.eq'], ...(j === 0 ? [] : [/** @type {Instruction} */ (['i32.or'])])])
        const a = valueOf(deeper(scoped), taken, body, type)
        const b = chain(deeper(inner), k + 1, taken + a.locals.length)
        return { code: [...test, ['if', blockType(env, type)], ...a.code, ['else'], ...b.code, ['end']], locals: [...a.locals, ...b.locals] }
    }
    const branches = chain(env, 0, c.locals.length + kept.length + tagged.length)
    /** @type {Expr} */
    const keep = here === null ? [['local.set', slot]] : []
    /** @type {Expr} */
    const readOnce = tests > 1 ? [...readTag, ['local.set', tagSlot]] : []
    return {
        code: [...c.code, ...keep, ...readOnce, ...branches.code, ...afterNever(type)],
        locals: [...c.locals, ...kept, ...tagged, ...branches.locals],
    }
}

/** @type {(env: _Env, t: Typed) => _Code} */
const term = (env, [type, t]) => {
    switch (t[0]) {
        case 'lit': { return just([literal(type, t[2])]) }
        case 'get': { return just(carrier(env.interfaces, type).length === 0 ? [] : [['local.get', assertNotNullish(at(t[1])(env.locals))]]) }
        case 'let': {
            const [, name, value, body] = t
            const holds = carrier(env.interfaces, value[0])
            const v = term(env, value)
            const index = env.next + v.locals.length
            /** @type {Expr} */
            const set = holds.length === 0 ? [] : [['local.set', index]]
            const locals = holds.length === 0 ? env.locals : setReplace(name)(index)(env.locals)
            const b = term({ ...env, locals, next: index + holds.length }, body)
            return {
                code: [...v.code, ...set, ...b.code],
                locals: [...v.locals, ...holds.map(h => /** @type {const} */ ([name, h])), ...b.locals],
            }
        }
        case 'op': { return operator(env, type, t[1], t[2]) }
        case 'call': {
            const [, module, name, args] = t
            const [index, params] = assertNotNullish(at(name)(module === 'self' ? env.functions : assertNotNullish(at(module)(env.imports))))
            return sequence(env, args.map((x, k) => [x, params[k]]), [['call', index], ...afterNever(type)])
        }
        case 'make': { return just([]) }
        case 'variant': {
            const [, sum, name, payload] = t
            return sequence(env, [[payload, payload[0]]], [['i32.const', sum[1].findIndex(([k]) => k === name)]])
        }
        case 'match': {
            const [, operand, arms] = t
            if (operand[0][0] === 'sealed') { return sealedMatch(env, type, operand, arms) }
            const c = term(env, operand)
            if (arms.length === 1) {
                const b = valueOf(env, c.locals.length, arms[0][2], type)
                return { code: [...c.code, ['drop'], ...b.code], locals: [...c.locals, ...b.locals] }
            }
            const [[, , yes], [, , no]] = arms[0][0].includes('true') ? arms : [arms[1], arms[0]]
            const a = valueOf(deeper(env), c.locals.length, yes, type)
            const b = valueOf(deeper(env), c.locals.length + a.locals.length, no, type)
            return {
                code: [...c.code, ['if', blockType(env, type)], ...a.code, ['else'], ...b.code, ['end'], ...afterNever(type)],
                locals: [...c.locals, ...a.locals, ...b.locals],
            }
        }
        case 'block': {
            const [, label, , body] = t
            const b = valueOf(deeper({ ...env, labels: setReplace(label)(/** @type {const} */ ([env.depth, type]))(env.labels) }), 0, body, type)
            return { code: [['block', blockType(env, type)], ...b.code, ['end'], ...afterNever(type)], locals: b.locals }
        }
        case 'br': {
            const [, label, value] = t
            const [depth, target] = assertNotNullish(at(label)(env.labels))
            /** @type {Instruction} */
            const leave = label === 'return' ? ['return'] : ['br', env.depth - depth - 1]
            return sequence(env, [[value, target]], [leave])
        }
        default: { return just([['unreachable']]) }
    }
}

// functions and modules

/** Locals as the binary groups them: a run of one type at a time. @type {(types: readonly ValType[]) => Locals} */
const runs = types => {
    /** @type {Locals} */
    const none = []
    return types.reduce((done, t) => {
        const last = done.at(-1)
        return last !== undefined && last[1] === t ? [...done.slice(0, -1), [last[0] + 1, t]] : [...done, [1, t]]
    }, none)
}

/** @type {(interfaces: OrderedMap<Interface>, s: Signature) => FuncType} */
const signature = (interfaces, { params, result }) => ({
    params: params.flatMap(([, t]) => carrier(interfaces, t)),
    results: carrier(interfaces, result),
})

/** @type {(a: FuncType, b: FuncType) => boolean} */
const same = (a, b) => equal(a.params, b.params) && equal(a.results, b.results)

/** A callee, by its index and its signature. @type {(index: number, s: Signature) => _Callee} */
const callee = (index, { params }) => [index, params.map(([, t]) => t)]

/**
 * A checked module as a WASM module: an import for each function of each
 * interface that it imports, then a function each of its own, in their
 * order, a type for each distinct signature, the exports by their names,
 * and a name section for the functions and their locals.
 *
 * @type {(m: Checked) => WasmModule}
 */
export const emit = m => {
    const interfaces = fromEntries(m.imports)
    const imported = m.imports.flatMap(([module, { abi, functions }]) => functions.map(([name, s]) => ({ module, abi, name, s })))
    const signatures = [...imported.map(({ s }) => signature(interfaces, s)), ...m.functions.map(([, f]) => signature(interfaces, f))]
    const types = signatures.filter((s, k) => signatures.findIndex(x => same(x, s)) === k)
    const typeOf = /** @type {(k: number) => number} */ (k => types.findIndex(x => same(x, signatures[k])))
    const imports = fromEntries(m.imports.map(([module]) => /** @type {const} */ ([
        module,
        fromEntries(imported.flatMap((x, k) => x.module === module ? [/** @type {const} */ ([x.name, callee(k, x.s)])] : [])),
    ])))
    const own = imported.length
    const functions = fromEntries(m.functions.map(([name, f], k) => /** @type {const} */ ([name, callee(own + k, f)])))
    const codes = m.functions.map(([, { params, result, body }]) => valueOf({
        locals: fromEntries(params.map(([name], k) => [name, k])),
        labels: setReplace('return')(/** @type {const} */ ([-1, result]))(empty),
        depth: 0,
        next: params.length,
        functions,
        imports,
        interfaces,
    }, 0, body, result))
    return {
        types,
        imports: imported.map(({ abi, name }, k) => ({ module: abi, name, desc: ['func', typeOf(k)] })),
        functions: codes.map((c, k) => ({
            type: typeOf(own + k),
            locals: runs(c.locals.map(([, t]) => t)),
            body: c.code,
        })),
        tables: [],
        memories: [],
        globals: [],
        exports: m.exports.map(name => ({ name, kind: 'func', index: own + m.functions.findIndex(([k]) => k === name) })),
        start: null,
        elements: [],
        dataCount: null,
        data: [],
        customs: [{
            after: 'code',
            content: ['name', [
                ['function', [
                    ...imported.map(({ module, name }, k) => /** @type {const} */ ([k, `${module}.${name}`])),
                    ...m.functions.map(([name], k) => /** @type {const} */ ([own + k, name])),
                ]],
                ['local', m.functions.map(([, f], k) => [own + k, [...f.params.map(([name]) => name), ...codes[k].locals.map(([name]) => name)].map((name, j) => [j, name])])],
            ]],
        }],
    }
}
