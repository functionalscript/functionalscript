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
 * - **A local narrows where a comparison narrowed it.** A local keeps the
 *   word of the type that it was bound at, and where a branch on a
 *   comparison gives it a range that fits 32 bits, a read of an `i64`
 *   local wraps it, which keeps its value.
 * - **A sealed type is its carrier**, the WASM value that its interface
 *   names: `any` is an `i64`, a builder an `i32`. A function of an
 *   interface is an import of the interface's `abi` by the function's name,
 *   so the functions that share a name, as the four `length`s do, share the
 *   host's function too. Imports come first, an interface at a time.
 * - **A `code` value is an `i32` table index.** `code(f)` is the index of
 *   `f` in the module's one `funcref` table, filled by an active element
 *   segment of the functions that any `code` term names. `call_ref` is
 *   `call_indirect` of that table, with the code value as the index. Where
 *   the module imports an interface that a host binds, the loader makes
 *   the table, and the module imports it as `table`, with `table_base`, the
 *   index of its first entry, from the first such interface's `abi`
 *   ([L0 design §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)):
 *   the segment starts there, `code(f)` adds it to `f`'s place, and
 *   `fjs.layout` says how many entries the module needs. A host's
 *   `make_function` then calls the code at its index in the table it made
 *   ([slice 11b](../todo/slices.md#decisions-for-slice-11-2026-11-20)).
 *   A module that imports no such interface, L0's `Memory` alone or
 *   nothing, hands no code to a host, so it keeps a table of its own.
 * - **A function that gives back a parameter is an import that answers
 *   nothing** ([definition.md's binding rule 3](../../../doc/sasha-gil/ir/definition.md#bindings)):
 *   the call keeps the parameter's value in a local named for the
 *   parameter, with a `local.tee` as it passes it, and reads it again after
 *   the call, as Containers' `push` gives back its builder.
 * - **A function of L0's `Memory` is an instruction**, which the emitter
 *   writes in place of a call: `load8` to `load64` and `store8` to
 *   `store64` are the loads and stores of their widths, at natural
 *   alignment, and `size` and `grow` are `memory.size` and `memory.grow`.
 *   An interface that says `instructions` imports no function and no
 *   constant, and a module that imports one imports the memory that the
 *   loader makes, from the interface's `abi`, which is the one that its
 *   literals' segment is in where it has string literals
 *   ([heap.md](../../../doc/sasha-gil/ir/heap.md#memory-in-the-ir)).
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
 * - **A string literal is a global too**, one for each type and spelling,
 *   which the module's start function sets once, before `init`
 *   ([L0 design §6](../../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up)),
 *   by the function that its type names as the maker of its literals:
 *   String's `make_string` for `any`. The maker takes the address and the
 *   length of the literal's UTF-16 units, which a data segment holds, the
 *   low byte of each first. The memory and `data_base`, where the segment
 *   starts, are imports of the loader
 *   ([L0 design §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
 *   from the maker's `abi`, and the `fjs.layout` section says how many
 *   bytes the segment needs.
 *
 * The functions keep their order and their names, which the name section
 * holds with their parameters and the locals of their `let`s and loops, and
 * an import is named for its interface and its function: `String.length`.
 * `init` comes after them, with the locals of the constants' terms, then
 * the start function, named `start`. A global is named for its interface
 * and its constant, `Any.undefined`, for the module's constant, or for a
 * literal's spelling in single quotes: `'abc'`.
 *
 * @module
 *
 * @import { BlockType, Bytes, Custom, Export, Expr, FuncType, Import, IndirectNameMap, Instruction, Locals, Module as WasmModule, NameMap, ValType } from '../../media/wasm/types.ts'
 * @import { Checked, Code, ConstantOf, Int, Interface, OpName, Sealed, SealedDef, Signature, Type, Typed, TypedArm } from '../types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { _Bound, _Callee, _Code, _EmitTerm, _Env, _Target, _ValueOf } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { bitsOf } from '../../types/number/module.f.js'
import { stringToList } from '../../text/utf16/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { at, empty, fromEntries, setReplace } from '../../types/ordered_map/module.f.js'
import { compareIn, definedBy, equal, fits, i, inside, interfacesOf, never, u } from '../module.f.js'

// values

/** A sealed type's definition in the interface that names it, which the checker found. @type {(interfaces: OrderedMap<Interface>, t: Sealed) => SealedDef} */
const definition = (interfaces, [, module, name]) =>
    assertNotNullish(assertNotNullish(at(module)(interfaces)).types.find(([k]) => k === name))[1]

/**
 * Whether two string literals' types are one: of one sealed type, since the
 * checker takes a literal of the variant its type's literals hold alone,
 * which `t.only(v)` and, where `v` is its one variant, `t` both write.
 *
 * @type {(a: Type, b: Type) => boolean}
 */
const oneType = (a, b) => a[0] === 'sealed' && b[0] === 'sealed' && a[1] === b[1] && a[2] === b[2]

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

/** The WASM value of a scalar. A sealed type's is the one its interface names. A code value is an `i32` table index. @type {(interfaces: OrderedMap<Interface>, t: Type) => ValType} */
const scalar = (interfaces, t) =>
    t[0] === 'int' ? (fits(32)(t) ? 'i32' : 'i64')
    : t[0] === 'f64' || t[0] === 'f64c' ? 'f64'
    : t[0] === 'sealed' ? definition(interfaces, t).carrier
    : t[0] === 'code' ? 'i32'
    : 'i32'

/** The locals that hold a value of `t`, named for the parts they hold. @type {(interfaces: OrderedMap<Interface>, name: string, t: Type) => _Code['locals']} */
const localsOf = (interfaces, name, t) => scalars(name, t).map(([k, x]) => [k, scalar(interfaces, x)])

/** The WASM values that hold a value of `t`, in their order. @type {(interfaces: OrderedMap<Interface>, t: Type) => readonly ValType[]} */
const carrier = (interfaces, t) => localsOf(interfaces, '', t).map(([, x]) => x)

/** The WASM type of a code value's call. @type {(interfaces: OrderedMap<Interface>, t: Code) => FuncType} */
const codeType = (interfaces, [, params, result]) => ({
    params: params.flatMap(([, x]) => carrier(interfaces, x)),
    results: carrier(interfaces, result),
})

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

/**
 * What reads a local bound at `from` as `to`, the range that a branch on a
 * comparison narrowed it to: an `i64` whose range now fits 32 bits is
 * wrapped, which keeps its value, since the value is in the range.
 *
 * @type {(from: Type, to: Type) => Expr}
 */
const narrowed = (from, to) =>
    from[0] === 'int' && to[0] === 'int' && width(to) < width(from) ? [['i32.wrap_i64']] : []

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
        case 'and': { return i32 ? ['i32.and'] : ['i64.and'] }
        case 'or': { return i32 ? ['i32.or'] : ['i64.or'] }
        case 'xor': { return i32 ? ['i32.xor'] : ['i64.xor'] }
        case 'shl': { return i32 ? ['i32.shl'] : ['i64.shl'] }
        case 'shr': { return i32 ? ['i32.shr_u'] : ['i64.shr_u'] }
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
        case 'to_bits': { return ['i64.reinterpret_f64'] }
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

// memory

/**
 * The instruction that the target binds each function of L0's `Memory`
 * with, which the emitter writes in place of a call: a load or a store of
 * the function's width at its natural alignment and no offset, a load of 8
 * or 16 bits extended with zeros, and the one memory's `memory.size` and
 * `memory.grow`.
 *
 * @type {OrderedMap<Instruction>}
 */
const memoryInstructions = fromEntries([
    ['load8', ['i32.load8_u', { align: 0, offset: 0 }]],
    ['load16', ['i32.load16_u', { align: 1, offset: 0 }]],
    ['load32', ['i32.load', { align: 2, offset: 0 }]],
    ['load64', ['i64.load', { align: 3, offset: 0 }]],
    ['store8', ['i32.store8', { align: 0, offset: 0 }]],
    ['store16', ['i32.store16', { align: 1, offset: 0 }]],
    ['store32', ['i32.store', { align: 2, offset: 0 }]],
    ['store64', ['i64.store', { align: 3, offset: 0 }]],
    ['size', ['memory.size', 0]],
    ['grow', ['memory.grow', 0]],
])

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
    if (t[0] === 'lit' && typeof t[2] !== 'string') { return just([literal(to, t[2])]) }
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

/** The bits of the one NaN of an `f64c`. */
const NAN = 0x7FF8_0000_0000_0000n

/**
 * `canon`: the float, or the one NaN where it is a NaN, which is the one
 * float that is not equal to itself.
 *
 * @type {(emitTerm: _EmitTerm, env: _Env, x: Typed) => _Code}
 */
const canon = (emitTerm, env, x) => {
    const c = sequence(emitTerm, env, [[x, x[0]]], [])
    const slot = env.next + c.locals.length
    return {
        code: [...c.code, ['local.set', slot], ['f64.const', NAN], ['local.get', slot], ['local.get', slot], ['local.get', slot], ['f64.ne'], ['select']],
        locals: [...c.locals, ['canon', 'f64']],
    }
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
    // A sealed value and the bits of its carrier are one WASM value.
    if (name === 'unseal' || name === 'release') { return sequence(emitTerm, env, [[args[0], args[0][0]]], []) }
    if (name === 'seal') { return sequence(emitTerm, env, [[args[0], carrier(env.interfaces, type)[0] === 'i64' ? u(64) : u(32)]], []) }
    const ints = args.flatMap(([t]) => t[0] === 'int' ? [t] : [])
    const own = args.map(x => /** @type {const} */ ([x, x[0]]))
    if (name === 'canon') { return canon(emitTerm, env, args[0]) }
    if (ints.length === 0) { return sequence(emitTerm, env, own, [float(name)]) }
    if (name === 'float') { return sequence(emitTerm, env, own, [convert(ints[0])]) }
    if (name === 'from_bits') { return sequence(emitTerm, env, [[args[0], u(64)]], [['f64.reinterpret_i64']]) }
    /** The operands as values of `bits`. @type {(bits: 32 | 64) => readonly (readonly [Typed, Type])[]} */
    const inWord = bits => args.map((x, k) => [x, word(ints[Number(k)], bits)])
    if (name === 'eq' || name === 'lt' || name === 'le') {
        const { bits, signed: isSigned } = assertNotNullish(compareIn(ints[0], ints[1]))
        return sequence(emitTerm, env, inWord(bits), [integer(name, bits, isSigned)])
    }
    const words = [type, ...ints].map(t => carrier(env.interfaces, t)[0])
    // WASM reads an `i32` shift's count modulo 32, so a count that may reach 32 shifts an `i64`.
    const wideShift = (name === 'shl' || name === 'shr') && ints[1][2] >= 32n
    const bits = words.includes('i64') || wideShift ? 64 : 32
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
        const index = own.length === 0 ? 0 : assertNotNullish(at(x[1])(env.locals))[0]
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
    // The checker takes a `match` only of a sealed type that names its kind.
    const [kindIndex] = assertNotNullish(at(assertNotNullish(kind))(assertNotNullish(at(sealed[1])(env.imports))))
    const here = x[0] === 'get' ? assertNotNullish(at(x[1])(env.locals))[0] : null
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
        const scoped = binder === null ? inner : { ...inner, locals: setReplace(binder)(/** @type {const} */ ([slot, of]))(inner.locals) }
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
        case 'lit': {
            const v = t[2]
            if (typeof v !== 'string') { return just([literal(type, v)]) }
            const found = env.literals.find(([u, s]) => s === v && oneType(u, type))
            return just([['global.get', assertNotNullish(found)[2]]])
        }
        case 'get': {
            const holds = carrier(env.interfaces, type)
            const [index, bound] = holds.length === 0 ? [0, type] : assertNotNullish(at(t[1])(env.locals))
            return just([...holds.map((_, k) => /** @type {Instruction} */ (['local.get', index + k])), ...narrowed(bound, type)])
        }
        case 'let': {
            const [, name, value, body] = t
            const holds = localsOf(env.interfaces, name, value[0])
            const v = term(env, value)
            const index = env.next + v.locals.length
            /** @type {Expr} */
            const set = holds.map((_, k) => /** @type {Instruction} */ (['local.set', index + k])).toReversed()
            const locals = holds.length === 0 ? env.locals : setReplace(name)(/** @type {const} */ ([index, value[0]]))(env.locals)
            const b = term({ ...env, locals, next: index + holds.length }, body)
            return {
                code: [...v.code, ...set, ...b.code],
                locals: [...v.locals, ...holds, ...b.locals],
            }
        }
        case 'op': { return operator(term, env, type, t[1], t[2]) }
        case 'call': {
            const [, module, name, args] = t
            const bound = module === 'self' ? null : at(module)(env.bound)
            if (bound !== null) {
                // The target binds the function with an instruction, which takes the arguments as a call of it would.
                const [instruction, ps] = assertNotNullish(at(name)(bound))
                return sequence(term, env, args.map((x, k) => /** @type {const} */ ([x, ps[Number(k)]])), [instruction])
            }
            const [index, params, back] = assertNotNullish(at(name)(module === 'self' ? env.functions : assertNotNullish(at(module)(env.imports))))
            /** @type {readonly (readonly [Typed, Type])[]} */
            const parts = args.map((x, k) => [x, params[Number(k)]])
            if (back === null) { return sequence(term, env, parts, [['call', index], ...afterNever(type)]) }
            // The import takes the value that the function gives back once and does not answer it, so a local keeps it.
            const [k, param] = back
            const before = sequence(term, env, parts.slice(0, k + 1), [])
            const slot = env.next + before.locals.length
            const kept = localsOf(env.interfaces, param, params[Number(k)])
            const rest = sequence(term, { ...env, next: slot + kept.length }, parts.slice(k + 1), [['call', index], ['local.get', slot]])
            return { code: [...before.code, ['local.tee', slot], ...rest.code], locals: [...before.locals, ...kept, ...rest.locals] }
        }
        case 'code': {
            const k = assertNotNullish(at(t[1])(env.codes))
            return just(env.tableBase === null ? [['i32.const', k]] : [['global.get', env.tableBase], ['i32.const', k], ['i32.add']])
        }
        case 'call_ref': {
            const [, callee, args] = t
            const of = callee[0]
            assert(of[0] === 'code', of)
            const typeIndex = env.types.findIndex(x => same(x, codeType(env.interfaces, of)))
            assert(typeIndex >= 0, of)
            // The checker and `terms` evaluate the callee first. Save its table index
            // so the arguments' effects cannot run before it, then push the index last.
            const before = sequence(term, env, [[callee, of]], [])
            const slot = env.next + before.locals.length
            /** @type {readonly (readonly [Typed, Type])[]} */
            const parts = args.map((x, k) => /** @type {const} */ ([x, of[1][Number(k)][1]]))
            const rest = sequence(term, { ...env, next: slot + 1 }, parts, [
                ['local.get', slot],
                ['call_indirect', typeIndex, 0],
                ...afterNever(type),
            ])
            return {
                code: [...before.code, ['local.set', slot], ...rest.code],
                locals: [...before.locals, /** @type {const} */ (['code', 'i32']), ...rest.locals],
            }
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
            const locals = params.reduce((ls, [k], j) => setReplace(k)(slots[Number(j)])(ls), env.locals)
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

/** The WASM type of a function: a function that gives back a parameter answers nothing. @type {(interfaces: OrderedMap<Interface>, s: Signature) => FuncType} */
const signature = (interfaces, { params, result, returns }) => ({
    params: params.flatMap(([, t]) => carrier(interfaces, t)),
    results: returns === undefined ? carrier(interfaces, result) : [],
})

/** A callee, by its index and its signature. @type {(index: number, s: Signature) => _Callee} */
const callee = (index, { params, returns }) => [index, params.map(([, t]) => t), returns === undefined ? null : [params.findIndex(([k]) => k === returns), returns]]

/** An import of a function of an interface, by its type's index. @type {(abi: string, name: string, type: number) => Import} */
const funcImport = (abi, name, type) => ({ module: abi, name, desc: ['func', type] })

/** An import of a constant of an interface: an immutable global of its carrier. @type {(abi: string, name: string, type: ValType) => Import} */
const globalImport = (abi, name, type) => ({ module: abi, name, desc: ['global', { type, mutable: false }] })

/** An import of the memory that the loader makes, which holds the data segments at `data_base`. @type {(abi: string) => Import} */
const memoryImport = abi => ({ module: abi, name: 'memory', desc: ['memory', { min: 0, max: null }] })

/** An import of the table that the loader makes, which holds the module's code at `table_base`. @type {(abi: string, entries: number) => Import} */
const tableImport = (abi, entries) => ({ module: abi, name: 'table', desc: ['table', { element: 'funcref', limits: { min: entries, max: null } }] })

/** An export of a function, by its index. @type {(name: string, index: number) => Export} */
const funcExport = (name, index) => ({ name, kind: 'func', index })

/** The string literals that a typed term holds, with their types, in their order. @type {(x: Typed) => readonly (readonly [Sealed, string])[]} */
const literalsOf = ([type, t]) => t[0] === 'lit' && type[0] === 'sealed' && typeof t[2] === 'string' ? [[type, t[2]]] : inside(t).flatMap(literalsOf)

/** The names of the module's functions that a typed term takes as `code` values. @type {(x: Typed) => readonly string[]} */
const codesOf = ([, t]) => t[0] === 'code' ? [t[1]] : inside(t).flatMap(codesOf)

/** Whether a typed term has a `call_ref`. @type {(x: Typed) => boolean} */
const hasCallRef = ([, t]) => t[0] === 'call_ref' || inside(t).some(hasCallRef)

/** The WASM types of the `call_ref`s in a typed term. @type {(interfaces: OrderedMap<Interface>, x: Typed) => readonly FuncType[]} */
const callRefTypes = (interfaces, [, t]) => t[0] === 'call_ref' && t[1][0][0] === 'code'
    ? [codeType(interfaces, t[1][0]), ...inside(t).flatMap(x => callRefTypes(interfaces, x))]
    : inside(t).flatMap(x => callRefTypes(interfaces, x))

/** A string's UTF-16 units as memory holds them, two bytes each, the low byte first. @type {(s: string) => Bytes} */
const unitsOf = s => toArray(stringToList(s)).flatMap(u => [u % 0x100, Math.floor(u / 0x100)])

/** An unsigned LEB128 number. @type {(n: number) => Bytes} */
const uleb = n => n < 0x80 ? [n] : [n % 0x80 + 0x80, ...uleb(Math.floor(n / 0x80))]

/**
 * The `fjs.layout` section: the sizes that the loader reserves before it
 * makes the module
 * ([L0 design §5](../../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)),
 * the data segments' bytes, the scratch space's, which no literal needs,
 * and the table's entries, each an unsigned LEB128 number.
 *
 * @type {(data: number, entries: number) => Custom}
 */
const layout = (data, entries) => ({ after: 'data', content: ['raw', 'fjs.layout', [...uleb(data), ...uleb(0), ...uleb(entries)]] })

/** The value that a global of a constant holds until `init` sets it. @type {(t: ValType) => Instruction} */
const zero = t => t === 'f64' ? ['f64.const', 0n] : t === 'i64' ? ['i64.const', 0n] : ['i32.const', 0]

/**
 * A checked module as a WASM module: an import for each function of each
 * interface that it imports from a host, then for each function that makes
 * its string literals, then its memory where it has string literals or
 * touches the memory, then a global for each constant of the interfaces,
 * and `data_base` where it has string literals; then a function each of its own, in their order, `init` where
 * it has constants, and the start function where it has string literals, a
 * global for each string literal and then for each of its constants, a type
 * for each distinct signature and then for each distinct block type of
 * more than one value, the exports by their names, the data segment of the
 * literals' units and the `fjs.layout` section, and a name section for the
 * functions, their locals and the globals.
 *
 * @type {(m: Checked) => WasmModule}
 */
export const emit = m => {
    const interfaces = fromEntries(interfacesOf(m))
    // An interface that says instructions is the target's, so it imports no function and no constant.
    const hosted = m.imports.filter(([, { instructions }]) => instructions !== true)
    const targets = m.imports.filter(([, { instructions }]) => instructions === true)
    const imported = hosted.flatMap(([module, { abi, functions }]) => functions.map(([member, s]) => ({ module, abi, member, s })))
    const importedConstants = hosted.flatMap(([module, { abi, constants = [] }]) => constants.map(([member, t]) => ({ module, abi, member, t })))
    const { constants } = m
    const written = [...m.functions.flatMap(([, f]) => literalsOf(f.body)), ...constants.flatMap(([, c]) => literalsOf(c.value))]
    // A literal is made once for its type and its spelling.
    const literals = written.filter(([t, s], k) => written.findIndex(([u, x]) => x === s && oneType(u, t)) === k)
    /** The function that makes a literal of a sealed type. @type {(t: Sealed) => { readonly abi: string, readonly module: string, readonly member: string, readonly type: FuncType }} */
    const makerOf = t => {
        const { carrier: c, literal } = definition(interfaces, t)
        const { module, member } = assertNotNullish(literal)
        return { abi: assertNotNullish(at(module)(interfaces)).abi, module, member, type: { params: ['i32', 'i32'], results: [c] } }
    }
    const made = literals.map(([t]) => makerOf(t))
    const makers = made.filter((x, k) => made.findIndex(y => y.abi === x.abi && y.member === x.member) === k)
    // `data_base` comes from the ABI of the first function that makes a literal: L0's, `fjs:l0`, for a string.
    const dataAbi = makers.length === 0 ? null : makers[0].abi
    // The memory comes from there, or from the ABI of the instructions, which the checker takes as one: a module imports one memory.
    const memoryAbi = dataAbi ?? (targets.length === 0 ? null : targets[0][1].abi)
    assert(targets.every(([, { abi }]) => abi === memoryAbi), memoryAbi)
    /** @type {readonly FuncType[]} */
    const init = constants.length === 0 ? [] : [{ params: [], results: [] }]
    /** @type {readonly FuncType[]} */
    const start = literals.length === 0 ? [] : [{ params: [], results: [] }]
    const referenced = m.functions.map(([name]) => name).filter(name =>
        m.functions.some(([, f]) => codesOf(f.body).includes(name))
        || constants.some(([, c]) => codesOf(c.value).includes(name)))
    // `call_indirect` needs table 0 even when no `code(f)` fills it.
    const needsTable = referenced.length > 0
        || m.functions.some(([, f]) => hasCallRef(f.body))
        || constants.some(([, c]) => hasCallRef(c.value))
    // The loader makes the table where the module imports an interface that a host binds, as it does the memory: a module that imports none hands no code to a host, and keeps a table of its own.
    const tableAbi = needsTable && hosted.length > 0 ? hosted[0][1].abi : null
    const signatures = [
        ...imported.map(({ s }) => signature(interfaces, s)),
        ...makers.map(({ type }) => type),
        ...m.functions.map(([, f]) => signature(interfaces, f)),
        ...init,
        ...start,
        ...m.functions.flatMap(([, f]) => blockTypes(interfaces, f.body)),
        ...constants.flatMap(([, c]) => blockTypes(interfaces, c.value)),
        ...m.functions.flatMap(([, f]) => callRefTypes(interfaces, f.body)),
        ...constants.flatMap(([, c]) => callRefTypes(interfaces, c.value)),
    ]
    const types = signatures.filter((s, k) => signatures.findIndex(x => same(x, s)) === k)
    const typeOf = /** @type {(k: number) => number} */ (k => types.findIndex(x => same(x, signatures[Number(k)])))
    const dataBase = importedConstants.length
    const tableBase = dataBase + (dataAbi === null ? 0 : 1)
    const literalBase = tableBase + (tableAbi === null ? 0 : 1)
    const constantBase = literalBase + literals.length
    const globals = fromEntries([
        ...hosted.map(([module]) => /** @type {const} */ ([
            module,
            fromEntries(importedConstants.flatMap((x, k) => x.module === module ? [/** @type {const} */ ([x.member, k])] : [])),
        ])),
        /** @type {const} */ (['self', fromEntries(constants.map(([name], k) => /** @type {const} */ ([name, constantBase + k])))]),
    ])
    const own = imported.length + makers.length
    const functions = fromEntries(m.functions.map(([name, f], k) => /** @type {const} */ ([name, callee(own + k, f)])))
    // A type that the module defines names its own functions, as `kind`, where an imported one names its interface's.
    const imports = fromEntries([
        ...hosted.map(([module]) => /** @type {const} */ ([
            module,
            fromEntries(imported.flatMap((x, k) => x.module === module ? [/** @type {const} */ ([x.member, callee(k, x.s)])] : [])),
        ])),
        ...(m.defines === undefined ? [] : [/** @type {const} */ ([assertNotNullish(definedBy(m)), functions])]),
    ])
    const codeIndex = fromEntries(referenced.map((name, k) => /** @type {const} */ ([name, k])))
    /** Each function of an interface that says instructions, one of L0's `Memory`, as the checker took. @type {OrderedMap<OrderedMap<_Bound>>} */
    const bound = fromEntries(targets.map(([module, { functions }]) => /** @type {const} */ ([
        module,
        fromEntries(functions.map(([member, s]) => /** @type {const} */ ([member, /** @type {const} */ ([assertNotNullish(at(member)(memoryInstructions)), s.params.map(([, t]) => t)])]))),
    ])))
    /** @type {_Env} */
    const base = {
        locals: empty, labels: empty, depth: 0, next: 0, functions, imports, bound, interfaces, types, globals, codes: codeIndex, tableBase: tableAbi === null ? null : tableBase,
        literals: literals.map(([t, s], j) => /** @type {const} */ ([t, s, literalBase + j])),
    }
    const codes = m.functions.map(([, { params, result, body }]) => valueOf(term, {
        ...base,
        locals: fromEntries(params.map(([name, type], k) => /** @type {const} */ ([name, /** @type {const} */ ([k, type])]))),
        labels: setReplace('return')(/** @type {const} */ ([-1, ['block', result]]))(empty),
        next: params.length,
    }, 0, body, result))
    const initIndex = own + m.functions.length
    /** @type {(done: _Code, constant: readonly [string, ConstantOf<Typed>], k: number) => _Code} */
    const evaluate = (done, [, { type, value }], k) => {
        const c = valueOf(term, { ...base, next: done.locals.length }, 0, value, type)
        return { code: [...done.code, ...c.code, ['global.set', constantBase + k]], locals: [...done.locals, ...c.locals] }
    }
    const initCode = constants.reduce(evaluate, just([]))
    const startIndex = initIndex + init.length
    /** The byte at which each literal's units start in the data segment. @type {readonly number[]} */
    const offsets = literals.reduce((done, [, s]) => [...done, assertNotNullish(done.at(-1)) + 2 * s.length], [0])
    /** @type {(maker: { readonly abi: string, readonly member: string }) => number} */
    const makerIndex = x => imported.length + makers.findIndex(y => y.abi === x.abi && y.member === x.member)
    /** @type {Expr} */
    const startCode = literals.flatMap(([, s], j) => [
        ['global.get', dataBase], ['i32.const', offsets[Number(j)]], ['i32.add'], ['i32.const', s.length],
        ['call', makerIndex(made[Number(j)])], ['global.set', literalBase + j],
    ])
    const bytes = literals.flatMap(([, s]) => unitsOf(s))
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
        ...(dataAbi === null ? [] : [/** @type {const} */ ([dataBase, 'data_base'])]),
        ...(tableAbi === null ? [] : [/** @type {const} */ ([tableBase, 'table_base'])]),
        ...literals.map(([, s], j) => /** @type {const} */ ([literalBase + j, `'${s}'`])),
        ...constants.map(([name], k) => /** @type {const} */ ([constantBase + k, name])),
    ]
    return {
        types,
        imports: [
            ...imported.map(({ abi, member }, k) => funcImport(abi, member, typeOf(k))),
            ...makers.map(({ abi, member }, k) => funcImport(abi, member, typeOf(imported.length + k))),
            ...(memoryAbi === null ? [] : [memoryImport(memoryAbi)]),
            ...(tableAbi === null ? [] : [tableImport(tableAbi, referenced.length)]),
            ...importedConstants.map(({ abi, member, t }) => globalImport(abi, member, carrier(interfaces, t)[0])),
            ...(dataAbi === null ? [] : [globalImport(dataAbi, 'data_base', 'i32')]),
            ...(tableAbi === null ? [] : [globalImport(tableAbi, 'table_base', 'i32')]),
        ],
        functions: [
            ...codes.map((c, k) => ({
                type: typeOf(own + k),
                locals: runs(c.locals.map(([, t]) => t)),
                body: c.code,
            })),
            ...(init.length === 0 ? [] : [{ type: typeOf(initIndex), locals: runs(initCode.locals.map(([, t]) => t)), body: initCode.code }]),
            ...(start.length === 0 ? [] : [{ type: typeOf(startIndex), locals: [], body: startCode }]),
        ],
        tables: needsTable && tableAbi === null ? [{ element: 'funcref', limits: { min: referenced.length, max: referenced.length } }] : [],
        memories: [],
        globals: [
            ...literals.map(([t]) => definition(interfaces, t).carrier),
            ...constants.map(([, { type }]) => carrier(interfaces, type)[0]),
        ].map(t => ({ type: { type: t, mutable: true }, init: [zero(t)] })),
        exports: [
            ...m.exports.map(name => funcExport(name, own + m.functions.findIndex(([k]) => k === name))),
            ...(init.length === 0 ? [] : [funcExport('init', initIndex)]),
        ],
        start: start.length === 0 ? null : startIndex,
        elements: referenced.length === 0 ? [] : [{
            mode: /** @type {const} */ (['active', 0, [tableAbi === null ? ['i32.const', 0] : ['global.get', tableBase]]]),
            init: /** @type {const} */ (['func', referenced.map(name => own + m.functions.findIndex(([k]) => k === name))]),
        }],
        dataCount: null,
        data: dataAbi === null ? [] : [{ mode: ['active', 0, [['global.get', dataBase]]], bytes }],
        customs: [
            {
                after: 'code',
                content: ['name', [
                    ['function', [
                        ...imported.map(({ module, member }, k) => /** @type {const} */ ([k, `${module}.${member}`])),
                        ...makers.map(({ module, member }, k) => /** @type {const} */ ([imported.length + k, `${module}.${member}`])),
                        ...m.functions.map(([name], k) => /** @type {const} */ ([own + k, name])),
                        ...(init.length === 0 ? [] : [/** @type {const} */ ([initIndex, 'init'])]),
                        ...(start.length === 0 ? [] : [/** @type {const} */ ([startIndex, 'start'])]),
                    ]],
                    ['local', localNames],
                    ...(globalNames.length === 0 ? [] : [/** @type {const} */ (['global', globalNames])]),
                ]],
            },
            ...(memoryAbi === null && tableAbi === null ? [] : [layout(bytes.length, tableAbi === null ? 0 : referenced.length)]),
        ],
    }
}
