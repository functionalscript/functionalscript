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
 * - **A comparison runs in the word that [`compareIn`](../module.f.js)
 *   picks**, signed where an operand may be negative.
 * - **A value widens where it meets a wider type**: where it is an operand,
 *   an argument or the value of a `br`, and where an arm or a body meets its
 *   `match`, `block` or function. An `i32` that stands for a value of an
 *   `i64` range is extended by its own signedness, and a literal is written
 *   in the wider word.
 * - **A `match` of a `bool` is an `if`**, a `block` is a `block`, and a `br`
 *   is a `br`, or a `return` to the label `return`. Where a `match`, a
 *   `block` or a `call` is `never`, an `unreachable` follows it, so that the
 *   code after it validates: WASM knows that nothing follows a `br`, and
 *   not that nothing follows these.
 *
 * The functions keep their order and their names, which the name section
 * holds with their parameters and the locals of their `let`s.
 *
 * @module
 *
 * @import { BlockType, Expr, FuncType, Instruction, Locals, Module as WasmModule, ValType } from '../../media/wasm/types.ts'
 * @import { Checked, FunctionOf, Int, OpName, Type, Typed } from '../types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { _Callee, _Code, _EmitTerm, _Env } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { bitsOf } from '../../media/rust/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { compareIn, equal, fits, i, never, u } from '../module.f.js'

// values

/** The WASM values that hold a value of `t`: one, or none for `unit` and `never`. @type {(t: Type) => readonly ValType[]} */
const carrier = t =>
    t[0] === 'int' ? [fits(32)(t) ? 'i32' : 'i64']
    : t[0] === 'f64' || t[0] === 'f64c' ? ['f64']
    : t[0] === 'sum' && t[1].length > 0 ? ['i32']
    : []

/** @type {(t: Type) => BlockType} */
const blockType = t => {
    const c = carrier(t)
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

// terms

/** @type {(code: Expr) => _Code} */
const just = code => ({ code, locals: [] })

/**
 * A term as a value of `to`, a type that holds the term's: a literal is
 * written in `to`'s word, and any other term is widened to it. Its locals
 * come after `taken` more.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, taken: number, x: Typed, to: Type) => _Code}
 */
const valueOf = (emitTerm, env, taken, [type, t], to) => {
    if (t[0] === 'lit') { return just([literal(to, t[2])]) }
    const c = emitTerm({ ...env, next: env.next + taken }, [type, t])
    return { code: [...c.code, ...widen(type, to)], locals: c.locals }
}

/**
 * Terms in their order, each as a value of the type beside it, then
 * `after`. Each term's locals follow those of the terms before it.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, parts: readonly (readonly [Typed, Type])[], after: Expr) => _Code}
 */
const sequence = (emitTerm, env, parts, after) => {
    const all = parts.reduce((done, [x, to]) => {
        const c = valueOf(emitTerm, env, done.locals.length, x, to)
        return { code: [...done.code, ...c.code], locals: [...done.locals, ...c.locals] }
    }, just([]))
    return { code: [...all.code, ...after], locals: all.locals }
}

/**
 * An operator: its operands, each made a value of the word that it runs in,
 * then its instruction, and a wrap where its result's word is narrower.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, type: Type, name: OpName, args: readonly Typed[]) => _Code}
 */
const operator = (emitTerm, env, type, name, args) => {
    const ints = args.flatMap(([t]) => t[0] === 'int' ? [t] : [])
    const own = args.map(x => /** @type {const} */ ([x, x[0]]))
    if (ints.length === 0) { return sequence(emitTerm, env, own, [float(name)]) }
    if (name === 'float') { return sequence(emitTerm, env, own, [convert(ints[0])]) }
    /** The operands as values of `bits`. @type {(bits: 32 | 64) => readonly (readonly [Typed, Type])[]} */
    const inWord = bits => args.map((x, k) => [x, word(ints[k], bits)])
    if (name === 'eq' || name === 'lt' || name === 'le') {
        const { bits, signed: isSigned } = assertNotNullish(compareIn(ints[0], ints[1]))
        return sequence(emitTerm, env, inWord(bits), [integer(name, bits, isSigned)])
    }
    const words = [type, ...ints].map(t => carrier(t)[0])
    const bits = words.includes('i64') ? 64 : 32
    /** @type {Expr} */
    const wrap = bits === 64 && words[0] === 'i32' ? [['i32.wrap_i64']] : []
    return sequence(emitTerm, env, inWord(bits), [integer(name, bits, false), ...wrap])
}

/** @type {(env: _Env) => _Env} */
const deeper = env => ({ ...env, depth: env.depth + 1 })

/** @type {_EmitTerm} */
const term = (env, [type, t]) => {
    switch (t[0]) {
        case 'lit': { return just([literal(type, t[2])]) }
        case 'get': { return just(carrier(type).length === 0 ? [] : [['local.get', assertNotNullish(at(t[1])(env.locals))]]) }
        case 'let': {
            const [, name, value, body] = t
            const holds = carrier(value[0])
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
        case 'op': { return operator(term, env, type, t[1], t[2]) }
        case 'call': {
            const [, , name, args] = t
            const [index, params] = assertNotNullish(at(name)(env.functions))
            return sequence(term, env, args.map((x, k) => [x, params[k]]), [['call', index], ...afterNever(type)])
        }
        case 'make': { return just([]) }
        case 'variant': {
            const [, sum, name, payload] = t
            return sequence(term, env, [[payload, payload[0]]], [['i32.const', sum[1].findIndex(([k]) => k === name)]])
        }
        case 'match': {
            const [, operand, arms] = t
            const c = term(env, operand)
            if (arms.length === 1) {
                const b = valueOf(term, env, c.locals.length, arms[0][1], type)
                return { code: [...c.code, ['drop'], ...b.code], locals: [...c.locals, ...b.locals] }
            }
            const [[, yes], [, no]] = arms[0][0].includes('true') ? arms : [arms[1], arms[0]]
            const a = valueOf(term, deeper(env), c.locals.length, yes, type)
            const b = valueOf(term, deeper(env), c.locals.length + a.locals.length, no, type)
            return {
                code: [...c.code, ['if', blockType(type)], ...a.code, ['else'], ...b.code, ['end'], ...afterNever(type)],
                locals: [...c.locals, ...a.locals, ...b.locals],
            }
        }
        case 'block': {
            const [, label, , body] = t
            const b = valueOf(term, deeper({ ...env, labels: setReplace(label)(/** @type {const} */ ([env.depth, type]))(env.labels) }), 0, body, type)
            return { code: [['block', blockType(type)], ...b.code, ['end'], ...afterNever(type)], locals: b.locals }
        }
        default: {
            const [, label, value] = t
            const [depth, target] = assertNotNullish(at(label)(env.labels))
            /** @type {Instruction} */
            const leave = label === 'return' ? ['return'] : ['br', env.depth - depth - 1]
            return sequence(term, env, [[value, target]], [leave])
        }
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

/** @type {(f: FunctionOf<Typed>) => FuncType} */
const signature = ({ params, result }) => ({ params: params.flatMap(([, t]) => carrier(t)), results: carrier(result) })

/** @type {(a: FuncType, b: FuncType) => boolean} */
const same = (a, b) => equal(a.params, b.params) && equal(a.results, b.results)

/**
 * A function's code: its parameters are its first locals, `return` leaves
 * it, and its body is a value of its result.
 *
 * @type {(functions: OrderedMap<_Callee>, f: FunctionOf<Typed>) => _Code}
 */
const code = (functions, { params, result, body }) => valueOf(term, {
    locals: fromEntries(params.map(([name], k) => [name, k])),
    labels: setReplace('return')(/** @type {const} */ ([-1, result]))(empty),
    depth: 0,
    next: params.length,
    functions,
}, 0, body, result)

/**
 * A checked module as a WASM module: a function each, in their order, a
 * type for each distinct signature, the exports by their names, and a name
 * section for the functions and their locals.
 *
 * @type {(m: Checked) => WasmModule}
 */
export const emit = m => {
    const signatures = m.functions.map(([, f]) => signature(f))
    const types = signatures.filter((s, k) => signatures.findIndex(x => same(x, s)) === k)
    const callees = fromEntries(m.functions.map(([name, f], k) => /** @type {const} */ ([name, [k, f.params.map(([, t]) => t)]])))
    const codes = m.functions.map(([, f]) => code(callees, f))
    return {
        types,
        imports: [],
        functions: codes.map((c, k) => ({
            type: types.findIndex(x => same(x, signatures[k])),
            locals: runs(c.locals.map(([, t]) => t)),
            body: c.code,
        })),
        tables: [],
        memories: [],
        globals: [],
        exports: m.exports.map(name => ({ name, kind: 'func', index: m.functions.findIndex(([k]) => k === name) })),
        start: null,
        elements: [],
        dataCount: null,
        data: [],
        customs: [{
            after: 'code',
            content: ['name', [
                ['function', m.functions.map(([name], k) => [k, name])],
                ['local', m.functions.map(([, f], k) => [k, [...f.params.map(([name]) => name), ...codes[k].locals.map(([name]) => name)].map((name, j) => [j, name])])],
            ]],
        }],
    }
}
