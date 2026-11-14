/**
 * The emitter: a module that the [checker](../check/module.f.js) took, as a
 * WebAssembly module in the AST of [`fjs/media/wasm`](../../media/wasm/types.ts),
 * whose [writer](../../media/wasm/binary/write/module.f.js) makes its bytes.
 *
 * It reads the types that the checker answered, and they alone decide what it
 * writes:
 *
 * - **A scalar is one WASM value.** A range is an `i32` where it fits 32
 *   bits and an `i64` where it does not, unsigned where it holds no
 *   negative integer and two's complement where it does. A float is an
 *   `f64`, and a `bool` an `i32`, `0` for `false` and `1` for `true`.
 * - **A product is its fields' values**, in their order, and `unit` and
 *   `never` are no value. A local of a product is a local for each, named
 *   for its field: `r.i`. A `match`, a `block` or a `loop` of more than one
 *   value has a type of its own in the type section, as WASM's multi-value
 *   blocks do, and `field` of a term that is no local keeps the field's
 *   values in locals named for it while it drops the rest.
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
 *   in the wider word. A `make` writes each field as a value of the wider
 *   field, and any other product is kept in locals named `widen` and read
 *   back field by field.
 * - **A sealed type is its carrier**, the WASM value that its interface
 *   names: `any` is an `i64`. A function of an interface is an import of
 *   the interface's `abi` by the function's name, so the functions that
 *   share a name, as the four `length`s do, share the host's function too.
 *   Imports come first, an interface at a time.
 * - **A `match` of a `bool` is an `if`**, a `block` is a `block`, and a `br`
 *   is a `br`, or a `return` to the label `return`. Where a `match`, a
 *   `block`, a `loop` or a `call` is `never`, an `unreachable` follows it,
 *   so that the code after it validates: WASM knows that nothing follows a
 *   `br`, and not that nothing follows these.
 * - **A `loop` is a `loop`, and its parameters are locals**, as many as
 *   their values. Their first values are set before it, and a `br` to it
 *   computes every next value before it sets any, then branches back to its
 *   start.
 * - **`trunc_sat` is the word's saturating truncation**, `trunc_sat_f64_s`
 *   or `trunc_sat_f64_u` of the range's word by its signedness, then a
 *   `select` for each bound of the range that lies inside the word, through
 *   a local named `trunc_sat`.
 * - **A `match` of a sealed type asks its interface for the tag**, through
 *   the function that the type names as its `kind`, once, and tests it with
 *   an `if` for each arm but the last, which takes the variants that no arm
 *   before it took. An arm's name for the operand is the operand's local.
 * - **A `trap` is an `unreachable`.**
 * - **A constant is a global**, which `constant` reads with `global.get`.
 *   One of an interface is an immutable global that the module imports
 *   from the interface's `abi` by the constant's name
 *   ([L0 design §3](../../../doc/sasha-gil/wasm/l0-design.md#3-constants-imported-immutable-globals)),
 *   each constant of each interface that it imports, after the functions.
 *   One of the module is a mutable global of zero, which `init`, a
 *   function that the module exports where it has constants, sets to the
 *   value of the constant's term, one constant at a time in their order
 *   ([L0 design §20](../../../doc/sasha-gil/wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)).
 *
 * The functions keep their order and their names, which the name section
 * holds with their parameters and the locals of their `let`s and loops, and
 * an import is named for its interface and its function: `String.length`.
 * `init` comes after them, with the locals of the constants' terms, and a
 * global is named for its interface and its constant, `Any.undefined`, or
 * for the module's constant.
 *
 * @module
 *
 * @import { BlockType, Export, Expr, FuncType, Import, IndirectNameMap, Instruction, Locals, Module as WasmModule, NameMap, ValType } from '../../media/wasm/types.ts'
 * @import { Checked, ConstantOf, Int, Interface, OpName, Sealed, SealedDef, Signature, Type, Typed, TypedArm } from '../types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { _Callee, _Code, _EmitTerm, _Env, _Target, _ValueOf } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { bitsOf } from '../../media/rust/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { compareIn, equal, fits, i, inside, never, u } from '../module.f.js'

// values

/** A sealed type's definition in the interface that names it, which the checker found. @type {(interfaces: OrderedMap<Interface>, t: Sealed) => SealedDef} */
const definition = (interfaces, [, module, name]) =>
    assertNotNullish(assertNotNullish(at(module)(interfaces)).types.find(([k]) => k === name))[1]

/**
 * The scalars that a value of `t` is, each named and typed, in the order of
 * their WASM values: a product's are its fields', each named `name.k`, and
 * `unit` and `never` have none.
 *
 * @type {(name: string, t: Type) => readonly (readonly [string, Type])[]}
 */
const scalars = (name, t) =>
    t[0] === 'product' ? t[1].flatMap(([k, x]) => scalars(`${name}.${k}`, x))
    : t[0] === 'sum' && t[1].length === 0 ? []
    : [[name, t]]

/** The WASM value of a scalar. A sealed type's is the one its interface names. @type {(interfaces: OrderedMap<Interface>, t: Type) => ValType} */
const scalar = (interfaces, t) =>
    t[0] === 'int' ? (fits(32)(t) ? 'i32' : 'i64')
    : t[0] === 'f64' || t[0] === 'f64c' ? 'f64'
    : t[0] === 'sealed' ? definition(interfaces, t).carrier
    : 'i32'

/** The locals that hold a value of `t`, named for the parts they hold. @type {(interfaces: OrderedMap<Interface>, name: string, t: Type) => _Code['locals']} */
const localsOf = (interfaces, name, t) => scalars(name, t).map(([k, x]) => [k, scalar(interfaces, x)])

/** The WASM values that hold a value of `t`, in their order. @type {(interfaces: OrderedMap<Interface>, t: Type) => readonly ValType[]} */
const carrier = (interfaces, t) => localsOf(interfaces, '', t).map(([, x]) => x)

/** @type {(a: FuncType, b: FuncType) => boolean} */
const same = (a, b) => equal(a.params, b.params) && equal(a.results, b.results)

/** A block's type: no value, one, or the type of the type section that gives them all. @type {(env: _Env, t: Type) => BlockType} */
const blockType = (env, t) => {
    const c = carrier(env.interfaces, t)
    /** @type {FuncType} */
    const results = { params: [], results: c }
    return c.length === 0 ? null : c.length === 1 ? c[0] : env.types.findIndex(x => same(x, results))
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
 * The values of a term of `from` on the stack as those of `to`, a type that
 * holds it: each scalar widened to its own, through locals named `widen`
 * where a product has more than one value and one of them is extended.
 *
 * @type {(env: _Env, from: Type, to: Type) => _Code}
 */
const widenAll = (env, from, to) => {
    const wide = scalars('', to)
    const each = scalars('', from).map(([, x], k) => widen(x, wide[Number(k)][1]))
    if (each.length < 2 || each.every(x => x.length === 0)) { return just(each.flat()) }
    const kept = localsOf(env.interfaces, 'widen', from)
    return {
        code: [...kept.map((_, k) => /** @type {Instruction} */ (['local.set', env.next + k])).toReversed(), ...each.flatMap((w, k) => [/** @type {Instruction} */ (['local.get', env.next + k]), ...w])],
        locals: kept,
    }
}

/**
 * Terms in their order, each as a value of the type beside it by `value`,
 * then `after`. Each term's locals follow those of the terms before it.
 * `value` is `valueOf`, handed in since the two call each other.
 *
 * @type {(value: _ValueOf, emitTerm: _EmitTerm, env: _Env, parts: readonly (readonly [Typed, Type])[], after: Expr) => _Code}
 */
const sequenceBy = (value, emitTerm, env, parts, after) => {
    const all = parts.reduce((done, [x, to]) => {
        const c = value(emitTerm, env, done.locals.length, x, to)
        return { code: [...done.code, ...c.code], locals: [...done.locals, ...c.locals] }
    }, just([]))
    return { code: [...all.code, ...after], locals: all.locals }
}

/**
 * A term as a value of `to`, a type that holds the term's: a literal is
 * written in `to`'s word, a `make` writes each field as a value of `to`'s,
 * and any other term is widened to it. Its locals come after `taken` more.
 *
 * @type {_ValueOf}
 */
const valueOf = (emitTerm, env, taken, [type, t], to) => {
    const here = { ...env, next: env.next + taken }
    if (t[0] === 'lit') { return just([literal(to, t[2])]) }
    if (t[0] === 'make') {
        // The checker types a `make` as a product, which only a product of the same fields holds.
        assert(to[0] === 'product', to)
        const fields = to[1]
        return sequenceBy(valueOf, emitTerm, here, t[1].map(([, x], j) => /** @type {const} */ ([x, fields[Number(j)][1]])), [])
    }
    const c = emitTerm(here, [type, t])
    const w = widenAll({ ...here, next: here.next + c.locals.length }, type, to)
    return { code: [...c.code, ...w.code], locals: [...c.locals, ...w.locals] }
}

/**
 * Terms in their order, each as a value of the type beside it, then
 * `after`. Each term's locals follow those of the terms before it.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, parts: readonly (readonly [Typed, Type])[], after: Expr) => _Code}
 */
const sequence = (emitTerm, env, parts, after) => sequenceBy(valueOf, emitTerm, env, parts, after)

/**
 * `trunc_sat` of a float to `t`: the WASM truncation that saturates to the
 * word of `t`, read as `t` reads it, then a `select` through a local, named
 * `trunc_sat`, for each bound of `t` inside the word's.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, t: Int, x: Typed) => _Code}
 */
const truncSat = (emitTerm, env, t, x) => {
    const bits = width(t)
    const isSigned = signed(t)
    const [, lo, hi] = isSigned ? i(bits) : u(bits)
    /** @type {Instruction} */
    const cut = bits === 32 ? (isSigned ? ['i32.trunc_sat_f64_s'] : ['i32.trunc_sat_f64_u'])
        : isSigned ? ['i64.trunc_sat_f64_s'] : ['i64.trunc_sat_f64_u']
    const c = sequence(emitTerm, env, [[x, x[0]]], [cut])
    const slot = env.next + c.locals.length
    const less = integer('lt', bits, isSigned)
    /** `bound` where `beyond` holds of the value, else the value. @type {(bound: bigint, beyond: Expr) => Expr} */
    const clamp = (bound, beyond) => [['local.set', slot], literal(t, bound), ['local.get', slot], ...beyond, ['select']]
    /** @type {Expr} */
    const low = t[1] > lo ? clamp(t[1], [['local.get', slot], literal(t, t[1]), less]) : []
    /** @type {Expr} */
    const high = t[2] < hi ? clamp(t[2], [literal(t, t[2]), ['local.get', slot], less]) : []
    /** @type {_Code['locals']} */
    const kept = low.length + high.length === 0 ? [] : [['trunc_sat', bits === 32 ? 'i32' : 'i64']]
    return { code: [...c.code, ...low, ...high], locals: [...c.locals, ...kept] }
}

/**
 * An operator: its operands, each made a value of the word that it runs in,
 * then its instruction, and a wrap where its result's word is narrower.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, type: Type, name: OpName, args: readonly Typed[]) => _Code}
 */
const operator = (emitTerm, env, type, name, args) => {
    if (name === 'trunc_sat') {
        // The checker types `trunc_sat` as the range that it saturates to.
        assert(type[0] === 'int', type)
        return truncSat(emitTerm, env, type, args[0])
    }
    const ints = args.flatMap(([t]) => t[0] === 'int' ? [t] : [])
    const own = args.map(x => /** @type {const} */ ([x, x[0]]))
    if (ints.length === 0) { return sequence(emitTerm, env, own, [float(name)]) }
    if (name === 'float') { return sequence(emitTerm, env, own, [convert(ints[0])]) }
    /** The operands as values of `bits`. @type {(bits: 32 | 64) => readonly (readonly [Typed, Type])[]} */
    const inWord = bits => args.map((x, k) => [x, word(ints[Number(k)], bits)])
    if (name === 'eq' || name === 'lt' || name === 'le') {
        const { bits, signed: isSigned } = assertNotNullish(compareIn(ints[0], ints[1]))
        return sequence(emitTerm, env, inWord(bits), [integer(name, bits, isSigned)])
    }
    const words = [type, ...ints].map(t => carrier(env.interfaces, t)[0])
    const bits = words.includes('i64') ? 64 : 32
    /** @type {Expr} */
    const wrap = bits === 64 && words[0] === 'i32' ? [['i32.wrap_i64']] : []
    return sequence(emitTerm, env, inWord(bits), [integer(name, bits, false), ...wrap])
}

/** @type {(env: _Env) => _Env} */
const deeper = env => ({ ...env, depth: env.depth + 1 })

/** The labels of `env` and `label`, which names a structure at `env`'s depth. @type {(env: _Env, label: string, target: _Target) => _Env['labels']} */
const labelled = (env, label, target) => setReplace(label)(/** @type {const} */ ([env.depth, target]))(env.labels)

/** The values on the stack, the last on top, each into its parameter's locals, from the parameter's first. @type {(env: _Env, slots: readonly (readonly [number, Type])[]) => Expr} */
const setAll = (env, slots) => slots.flatMap(([slot, t]) => carrier(env.interfaces, t).map((_, k) => /** @type {Instruction} */ (['local.set', slot + k]))).toReversed()

/**
 * A field of a product: of a local, its own locals; of any other term, the
 * term's values, the field's kept in locals named for it, where values come
 * before it, while the rest are dropped.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, type: Type, e: Typed, name: string) => _Code}
 */
const fieldOf = (emitTerm, env, type, e, name) => {
    const [of, x] = e
    // The checker reads a field of a product only.
    assert(of[0] === 'product', of)
    const k = of[1].findIndex(([f]) => f === name)
    const all = carrier(env.interfaces, of)
    const start = of[1].slice(0, k).flatMap(([, f]) => carrier(env.interfaces, f)).length
    const own = localsOf(env.interfaces, name, type)
    if (x[0] === 'get') {
        const index = own.length === 0 ? 0 : assertNotNullish(at(x[1])(env.locals))
        return just(own.map((_, j) => ['local.get', index + start + j]))
    }
    const c = emitTerm(env, e)
    /** @type {Expr} */
    const later = all.slice(start + own.length).map(() => ['drop'])
    if (start === 0) { return { code: [...c.code, ...later], locals: c.locals } }
    const slot = env.next + c.locals.length
    /** @type {Expr} */
    const earlier = all.slice(0, start).map(() => ['drop'])
    return {
        code: [
            ...c.code, ...later,
            ...own.map((_, j) => /** @type {Instruction} */ (['local.set', slot + j])).toReversed(),
            ...earlier,
            ...own.map((_, j) => /** @type {Instruction} */ (['local.get', slot + j])),
        ],
        locals: [...c.locals, ...own],
    }
}

/**
 * A `match` of a sealed type. A `get` is read from its local, and any other
 * operand is kept in one, named `match`, which the arms' names read. Where
 * the arms test more than one variant, the tag is read once, into a local
 * named for the operand: `v.kind`.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, type: Type, operand: Typed, arms: readonly TypedArm[]) => _Code}
 */
const sealedMatch = (emitTerm, env, type, operand, arms) => {
    const [of, x] = operand
    const sealed = /** @type {Sealed} */ (of)
    const { variants, kind } = definition(env.interfaces, sealed)
    const [kindIndex] = assertNotNullish(at(kind)(assertNotNullish(at(sealed[1])(env.imports))))
    const here = x[0] === 'get' ? assertNotNullish(at(x[1])(env.locals)) : null
    const c = here === null ? emitTerm(env, operand) : just([])
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
        const [vs, binder, body] = arms[Number(k)]
        const scoped = binder === null ? inner : { ...inner, locals: setReplace(binder)(slot)(inner.locals) }
        if (k === arms.length - 1) { return valueOf(emitTerm, scoped, taken, body, type) }
        /** @type {Expr} */
        const test = vs.flatMap((v, j) => [...tag, ['i32.const', variants.indexOf(v)], ['i32.eq'], ...(j === 0 ? [] : [/** @type {Instruction} */ (['i32.or'])])])
        const a = valueOf(emitTerm, deeper(scoped), taken, body, type)
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

/** @type {_EmitTerm} */
const term = (env, [type, t]) => {
    switch (t[0]) {
        case 'lit': { return just([literal(type, t[2])]) }
        case 'get': {
            const holds = carrier(env.interfaces, type)
            const index = holds.length === 0 ? 0 : assertNotNullish(at(t[1])(env.locals))
            return just(holds.map((_, k) => ['local.get', index + k]))
        }
        case 'let': {
            const [, name, value, body] = t
            const holds = localsOf(env.interfaces, name, value[0])
            const v = term(env, value)
            const index = env.next + v.locals.length
            /** @type {Expr} */
            const set = holds.map((_, k) => /** @type {Instruction} */ (['local.set', index + k])).toReversed()
            const locals = holds.length === 0 ? env.locals : setReplace(name)(index)(env.locals)
            const b = term({ ...env, locals, next: index + holds.length }, body)
            return {
                code: [...v.code, ...set, ...b.code],
                locals: [...v.locals, ...holds, ...b.locals],
            }
        }
        case 'op': { return operator(term, env, type, t[1], t[2]) }
        case 'call': {
            const [, module, name, args] = t
            const [index, params] = assertNotNullish(at(name)(module === 'self' ? env.functions : assertNotNullish(at(module)(env.imports))))
            return sequence(term, env, args.map((x, k) => [x, params[Number(k)]]), [['call', index], ...afterNever(type)])
        }
        case 'make': { return sequence(term, env, t[1].map(([, x]) => /** @type {const} */ ([x, x[0]])), []) }
        case 'field': { return fieldOf(term, env, type, t[1], t[2]) }
        case 'variant': {
            const [, sum, name, payload] = t
            return sequence(term, env, [[payload, payload[0]]], [['i32.const', sum[1].findIndex(([k]) => k === name)]])
        }
        case 'match': {
            const [, operand, arms] = t
            if (operand[0][0] === 'sealed') { return sealedMatch(term, env, type, operand, arms) }
            const c = term(env, operand)
            if (arms.length === 1) {
                const b = valueOf(term, env, c.locals.length, arms[0][2], type)
                return { code: [...c.code, ['drop'], ...b.code], locals: [...c.locals, ...b.locals] }
            }
            const [[, , yes], [, , no]] = arms[0][0].includes('true') ? arms : [arms[1], arms[0]]
            const a = valueOf(term, deeper(env), c.locals.length, yes, type)
            const b = valueOf(term, deeper(env), c.locals.length + a.locals.length, no, type)
            return {
                code: [...c.code, ['if', blockType(env, type)], ...a.code, ['else'], ...b.code, ['end'], ...afterNever(type)],
                locals: [...c.locals, ...a.locals, ...b.locals],
            }
        }
        case 'block': {
            const [, label, , body] = t
            const b = valueOf(term, deeper({ ...env, labels: labelled(env, label, ['block', type]) }), 0, body, type)
            return { code: [['block', blockType(env, type)], ...b.code, ['end'], ...afterNever(type)], locals: b.locals }
        }
        case 'loop': {
            const [, label, params, body] = t
            const firsts = sequence(term, env, params.map(([, x, first]) => /** @type {const} */ ([first, x])), [])
            const own = params.map(([k, x]) => localsOf(env.interfaces, k, x))
            const base = env.next + firsts.locals.length
            /** @type {readonly (readonly [number, Type])[]} */
            const slots = params.map(([, x], j) => [base + own.slice(0, j).flat().length, x])
            const locals = params.reduce((ls, [k], j) => setReplace(k)(slots[Number(j)][0])(ls), env.locals)
            const inner = deeper({ ...env, locals, next: base + own.flat().length, labels: labelled(env, label, ['loop', slots]) })
            const b = valueOf(term, inner, 0, body, type)
            return {
                code: [...firsts.code, ...setAll(env, slots), ['loop', blockType(env, type)], ...b.code, ['end'], ...afterNever(type)],
                locals: [...firsts.locals, ...own.flat(), ...b.locals],
            }
        }
        case 'br': {
            const [, label, value] = t
            const [depth, target] = assertNotNullish(at(label)(env.labels))
            /** @type {Instruction} */
            const leave = label === 'return' ? ['return'] : ['br', env.depth - depth - 1]
            if (target[0] === 'block') { return sequence(term, env, [[value, target[1]]], [leave]) }
            // The checker takes a `br` to a loop only with a `make` of the loop's parameters.
            const v = value[1]
            assert(v[0] === 'make', v)
            return sequence(term, env, v[1].map(([, x], j) => /** @type {const} */ ([x, target[1][Number(j)][1]])), [...setAll(env, target[1]), leave])
        }
        case 'constant': { return just([['global.get', assertNotNullish(at(t[2])(assertNotNullish(at(t[1])(env.globals))))]]) }
        default: { return just([['unreachable']]) }
    }
}

// functions and modules

/**
 * The block types that a term needs in the type section: the results of
 * each `match`, `block` and `loop` in it that has more than one value.
 *
 * @type {(interfaces: OrderedMap<Interface>, x: Typed) => readonly FuncType[]}
 */
const blockTypes = (interfaces, [type, t]) => {
    const results = carrier(interfaces, type)
    const own = results.length > 1 && (t[0] === 'match' || t[0] === 'block' || t[0] === 'loop') ? [{ params: [], results }] : []
    return [...own, ...inside(t).flatMap(x => blockTypes(interfaces, x))]
}

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

/** A callee, by its index and its signature. @type {(index: number, s: Signature) => _Callee} */
const callee = (index, { params }) => [index, params.map(([, t]) => t)]

/** An import of a function of an interface, by its type's index. @type {(abi: string, name: string, type: number) => Import} */
const funcImport = (abi, name, type) => ({ module: abi, name, desc: ['func', type] })

/** An import of a constant of an interface: an immutable global of its carrier. @type {(abi: string, name: string, type: ValType) => Import} */
const globalImport = (abi, name, type) => ({ module: abi, name, desc: ['global', { type, mutable: false }] })

/** An export of a function, by its index. @type {(name: string, index: number) => Export} */
const funcExport = (name, index) => ({ name, kind: 'func', index })

/** The value that a global of a constant holds until `init` sets it. @type {(t: ValType) => Instruction} */
const zero = t => t === 'f64' ? ['f64.const', 0n] : t === 'i64' ? ['i64.const', 0n] : ['i32.const', 0]

/**
 * A checked module as a WASM module: an import for each function of each
 * interface that it imports, then for each of their constants, then a
 * function each of its own, in their order, and `init` where it has
 * constants, a global for each of its constants, a type for each distinct
 * signature and then for each distinct block type of more than one value,
 * the exports by their names, and a name section for the functions, their
 * locals and the globals.
 *
 * @type {(m: Checked) => WasmModule}
 */
export const emit = m => {
    const interfaces = fromEntries(m.imports)
    const imported = m.imports.flatMap(([module, { abi, functions }]) => functions.map(([member, s]) => ({ module, abi, member, s })))
    const importedConstants = m.imports.flatMap(([module, { abi, constants = [] }]) => constants.map(([member, t]) => ({ module, abi, member, t })))
    const { constants } = m
    /** @type {readonly FuncType[]} */
    const init = constants.length === 0 ? [] : [{ params: [], results: [] }]
    const signatures = [
        ...imported.map(({ s }) => signature(interfaces, s)),
        ...m.functions.map(([, f]) => signature(interfaces, f)),
        ...init,
        ...m.functions.flatMap(([, f]) => blockTypes(interfaces, f.body)),
        ...constants.flatMap(([, c]) => blockTypes(interfaces, c.value)),
    ]
    const types = signatures.filter((s, k) => signatures.findIndex(x => same(x, s)) === k)
    const typeOf = /** @type {(k: number) => number} */ (k => types.findIndex(x => same(x, signatures[Number(k)])))
    const imports = fromEntries(m.imports.map(([module]) => /** @type {const} */ ([
        module,
        fromEntries(imported.flatMap((x, k) => x.module === module ? [/** @type {const} */ ([x.member, callee(k, x.s)])] : [])),
    ])))
    const globals = fromEntries([
        ...m.imports.map(([module]) => /** @type {const} */ ([
            module,
            fromEntries(importedConstants.flatMap((x, k) => x.module === module ? [/** @type {const} */ ([x.member, k])] : [])),
        ])),
        /** @type {const} */ (['self', fromEntries(constants.map(([name], k) => /** @type {const} */ ([name, importedConstants.length + k])))]),
    ])
    const own = imported.length
    const functions = fromEntries(m.functions.map(([name, f], k) => /** @type {const} */ ([name, callee(own + k, f)])))
    /** @type {_Env} */
    const base = { locals: empty, labels: empty, depth: 0, next: 0, functions, imports, interfaces, types, globals }
    const codes = m.functions.map(([, { params, result, body }]) => valueOf(term, {
        ...base,
        locals: fromEntries(params.map(([name], k) => [name, k])),
        labels: setReplace('return')(/** @type {const} */ ([-1, ['block', result]]))(empty),
        next: params.length,
    }, 0, body, result))
    const initIndex = own + m.functions.length
    /** @type {(done: _Code, constant: readonly [string, ConstantOf<Typed>], k: number) => _Code} */
    const evaluate = (done, [, { type, value }], k) => {
        const c = valueOf(term, { ...base, next: done.locals.length }, 0, value, type)
        return { code: [...done.code, ...c.code, ['global.set', importedConstants.length + k]], locals: [...done.locals, ...c.locals] }
    }
    const initCode = constants.reduce(evaluate, just([]))
    /** The names of locals, from those of their functions' parameters on. @type {(names: readonly string[]) => NameMap} */
    const named = names => names.map((name, j) => [j, name])
    /** @type {IndirectNameMap} */
    const localNames = [
        ...m.functions.map(([, f], k) => /** @type {const} */ ([own + k, named([...f.params.map(([name]) => name), ...codes[Number(k)].locals.map(([name]) => name)])])),
        ...(init.length === 0 ? [] : [/** @type {const} */ ([initIndex, named(initCode.locals.map(([name]) => name))])]),
    ]
    /** @type {NameMap} */
    const globalNames = [
        ...importedConstants.map(({ module, member }, k) => /** @type {const} */ ([k, `${module}.${member}`])),
        ...constants.map(([name], k) => /** @type {const} */ ([importedConstants.length + k, name])),
    ]
    return {
        types,
        imports: [
            ...imported.map(({ abi, member }, k) => funcImport(abi, member, typeOf(k))),
            ...importedConstants.map(({ abi, member, t }) => globalImport(abi, member, carrier(interfaces, t)[0])),
        ],
        functions: [
            ...codes.map((c, k) => ({
                type: typeOf(own + k),
                locals: runs(c.locals.map(([, t]) => t)),
                body: c.code,
            })),
            ...(init.length === 0 ? [] : [{ type: typeOf(initIndex), locals: runs(initCode.locals.map(([, t]) => t)), body: initCode.code }]),
        ],
        tables: [],
        memories: [],
        globals: constants.map(([, { type }]) => {
            const t = carrier(interfaces, type)[0]
            return { type: { type: t, mutable: true }, init: [zero(t)] }
        }),
        exports: [
            ...m.exports.map(name => funcExport(name, own + m.functions.findIndex(([k]) => k === name))),
            ...(init.length === 0 ? [] : [funcExport('init', initIndex)]),
        ],
        start: null,
        elements: [],
        dataCount: null,
        data: [],
        customs: [{
            after: 'code',
            content: ['name', [
                ['function', [
                    ...imported.map(({ module, member }, k) => /** @type {const} */ ([k, `${module}.${member}`])),
                    ...m.functions.map(([name], k) => /** @type {const} */ ([own + k, name])),
                    ...(init.length === 0 ? [] : [/** @type {const} */ ([initIndex, 'init'])]),
                ]],
                ['local', localNames],
                ...(globalNames.length === 0 ? [] : [/** @type {const} */ (['global', globalNames])]),
            ]],
        }],
    }
}
