/**
 * Writes the [AST](../../types.ts) as a binary WebAssembly module.
 *
 * **The output is canonical, not the input's.** Integers are written in their
 * shortest LEB128, an element segment in the shortest of the eight encodings
 * that holds it, and an empty known section not at all, so
 * [`parse`](../parse/module.f.mjs) of what this writes is the module it was
 * given, while the bytes need not be the ones that module was read from:
 * `wasm-ld`, for one, pads the indices it relocates to five bytes.
 *
 * A custom section is written after the known section it records. Where that
 * section has no items, it is written empty rather than left out, so `parse`
 * records the custom section after it again.
 *
 * @module
 *
 * @import { BlockType, Bytes, Custom, Data, Element, Export, Expr, FuncType, Global, GlobalType, Import, IndirectNameMap, Instruction, Limits, Module, NameMap, NameSubsection, RefType, SectionName, TableType, ValType } from '../../types.ts'
 */

import { stringToU8List } from '../../../../text/utf8/module.f.mjs'
import { toArray } from '../../../../types/list/alt/module.f.js'
import { encoding } from '../../instruction/module.f.js'

// values

/**
 * A LEB128 integer: unsigned, or signed in two's complement.
 *
 * @type {(signed: boolean) => (value: bigint) => Bytes}
 */
const leb = signed => value => {
    const x = value & 0x7fn
    const rest = value >> 7n
    const last = signed
        ? (rest === 0n && (x & 0x40n) === 0n) || (rest === -1n && (x & 0x40n) !== 0n)
        : rest === 0n
    return last ? [Number(x)] : [Number(x | 0x80n), ...leb(signed)(rest)]
}

/** @type {(value: number) => Bytes} */
const u32 = value => leb(false)(BigInt(value))

/** @type {(value: number) => Bytes} */
const s32 = value => leb(true)(BigInt(value))

/** @type {(value: bigint) => Bytes} */
const s64 = leb(true)

/**
 * A little-endian integer of `n` bytes.
 *
 * @type {(n: number) => (value: bigint) => Bytes}
 */
const fixed = n => value => Array.from({ length: n }, (_, k) => Number((value >> BigInt(8 * k)) & 0xffn))

/** @type {(items: readonly Bytes[]) => Bytes} */
const vec = items => [...u32(items.length), ...items.flat()]

/** @type {(text: string) => Bytes} */
const name = text => {
    const utf8 = toArray(stringToU8List(text))
    return [...u32(utf8.length), ...utf8]
}

// types

/** @type {Readonly<Record<RefType, number>>} */
const refTypes = { funcref: 0x70, externref: 0x6f }

/** @type {Readonly<Record<ValType, number>>} */
const valTypes = { i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c, ...refTypes }

/** @type {(t: FuncType) => Bytes} */
const funcType = ({ params, results }) => [
    0x60,
    ...vec(params.map(t => [valTypes[t]])),
    ...vec(results.map(t => [valTypes[t]])),
]

/** @type {(l: Limits) => Bytes} */
const limits = ({ min, max }) => max === null ? [0, ...u32(min)] : [1, ...u32(min), ...u32(max)]

/** @type {(t: TableType) => Bytes} */
const tableType = ({ element, limits: l }) => [refTypes[element], ...limits(l)]

/** @type {(t: GlobalType) => Bytes} */
const globalType = ({ type, mutable }) => [valTypes[type], mutable ? 1 : 0]

// instructions

/** @type {(t: BlockType) => Bytes} */
const blockType = t =>
    t === null ? [0x40]
    : typeof t === 'number' ? leb(true)(BigInt(t))
    : [valTypes[t]]

/**
 * An instruction's immediates, by the kind its encoding names.
 *
 * @type {(x: Instruction) => Bytes}
 */
const immediates = x => {
    const [, kind] = encoding(x)
    // `encoding` picked the row by the instruction's mnemonic, so its
    // immediates are of `kind`'s shape.
    const [, a, b] = /** @type {readonly [unknown, any, any]} */ (x)
    return kind === 'none' ? []
        : kind === 'block' ? blockType(a)
        : kind === 'index' ? u32(a)
        : kind === 'index2' ? [...u32(a), ...u32(b)]
        : kind === 'brTable' ? [...vec(a.map(u32)), ...u32(b)]
        : kind === 'select' ? vec(a.map((/** @type {ValType} */ t) => [valTypes[t]]))
        : kind === 'memarg' ? [...u32(a.align), ...u32(a.offset)]
        : kind === 'i32' ? s32(a)
        : kind === 'i64' ? s64(a)
        : kind === 'f32' ? fixed(4)(BigInt(a))
        : kind === 'f64' ? fixed(8)(a)
        : [refTypes[/** @type {RefType} */ (a)]]
}

/** @type {(x: Instruction) => Bytes} */
const instruction = x => {
    const [code] = encoding(x)
    const [first, ...rest] = code
    return [first, ...rest.flatMap(u32), ...immediates(x)]
}

/** An expression, closed by the `end` the AST leaves out. @type {(e: Expr) => Bytes} */
const expr = e => [...e.flatMap(instruction), 0x0b]

// sections

/** @type {Readonly<Record<Import['desc'][0] | Export['kind'], number>>} */
const externKinds = { func: 0, table: 1, memory: 2, global: 3 }

/** @type {(x: Import) => Bytes} */
const import_ = ({ module, name: n, desc }) => [
    ...name(module),
    ...name(n),
    externKinds[desc[0]],
    ...(desc[0] === 'func' ? u32(desc[1])
        : desc[0] === 'table' ? tableType(desc[1])
        : desc[0] === 'memory' ? limits(desc[1])
        : globalType(desc[1])),
]

/** @type {(x: Global) => Bytes} */
const global = ({ type, init }) => [...globalType(type), ...expr(init)]

/** @type {(x: Export) => Bytes} */
const export_ = ({ name: n, kind, index }) => [...name(n), externKinds[kind], ...u32(index)]

/**
 * A segment, in the encoding whose flag bits say what it is: bit 0 passive or
 * declarative, bit 1 an explicit table (when active) or declarative (when
 * not), bit 2 expressions. An active segment of table 0 leaves the table out,
 * and so its element kind or type, where those are `funcref`.
 *
 * @type {(x: Element) => Bytes}
 */
const element = ({ mode, init }) => {
    const isExpr = init[0] === 'expr'
    const items = init[0] === 'func' ? vec(init[1].map(u32)) : vec(init[2].map(expr))
    const kind = init[0] === 'func' ? [0x00] : [refTypes[init[1]]]
    const implicit = mode[0] === 'active' && mode[1] === 0 && (init[0] === 'func' || init[1] === 'funcref')
    const flag = (isExpr ? 4 : 0) + (mode[0] === 'active' ? (implicit ? 0 : 2) : mode[0] === 'passive' ? 1 : 3)
    return [
        ...u32(flag),
        ...(mode[0] !== 'active' ? kind
            : implicit ? expr(mode[2])
            : [...u32(mode[1]), ...expr(mode[2]), ...kind]),
        ...items,
    ]
}

/** @type {(x: Data) => Bytes} */
const data = ({ mode, bytes }) => [
    ...(mode[0] === 'passive' ? [1]
        : mode[1] === 0 ? [0, ...expr(mode[2])]
        : [2, ...u32(mode[1]), ...expr(mode[2])]),
    ...u32(bytes.length),
    ...bytes,
]

/** @type {(f: Module['functions'][number]) => Bytes} */
const code = ({ locals, body }) => {
    const content = [...vec(locals.map(([count, type]) => [...u32(count), valTypes[type]])), ...expr(body)]
    return [...u32(content.length), ...content]
}

// names

/** @type {(m: NameMap) => Bytes} */
const nameMap = m => vec(m.map(([index, n]) => [...u32(index), ...name(n)]))

/** @type {(m: IndirectNameMap) => Bytes} */
const indirectNameMap = m => vec(m.map(([index, names]) => [...u32(index), ...nameMap(names)]))

/** The id of each name subsection. */
const nameIds = {
    module: 0, function: 1, local: 2, label: 3, type: 4, table: 5,
    memory: 6, global: 7, elem: 8, data: 9, field: 10, tag: 11,
}

/** @type {(s: NameSubsection) => Bytes} */
const nameSubsection = s => {
    /** @type {(id: number, content: Bytes) => Bytes} */
    const sub = (id, content) => [id, ...u32(content.length), ...content]
    return s[0] === 'unknown' ? sub(s[1], s[2])
        : s[0] === 'module' ? sub(nameIds.module, name(s[1]))
        : s[0] === 'local' || s[0] === 'label' || s[0] === 'field' ? sub(nameIds[s[0]], indirectNameMap(s[1]))
        // What is left is a name map: TypeScript does not narrow the tuple
        // union by the three mnemonics above.
        : sub(nameIds[s[0]], nameMap(/** @type {NameMap} */ (s[1])))
}

/** @type {(c: Custom['content']) => Bytes} */
const custom = c => c[0] === 'name'
    ? [...name('name'), ...c[1].flatMap(nameSubsection)]
    : [...name(c[1]), ...c[2]]

// the module

/** @type {(id: number, content: Bytes) => Bytes} */
const section = (id, content) => [id, ...u32(content.length), ...content]

/**
 * Each known section in the order the format fixes: its id, its text name,
 * and its content: `null` where the module has none, and `'empty'` where it
 * is a vector of no items, written only where a custom section follows it.
 *
 * @type {(m: Module) => readonly (readonly [number, SectionName, Bytes | null | 'empty'])[]}
 */
const known = m => {
    /** @type {<T>(items: readonly T[], f: (x: T) => Bytes) => Bytes | 'empty'} */
    const some = (items, f) => items.length === 0 ? 'empty' : vec(items.map(f))
    return [
        [1, 'type', some(m.types, funcType)],
        [2, 'import', some(m.imports, import_)],
        [3, 'func', some(m.functions, f => u32(f.type))],
        [4, 'table', some(m.tables, tableType)],
        [5, 'memory', some(m.memories, limits)],
        [6, 'global', some(m.globals, global)],
        [7, 'export', some(m.exports, export_)],
        [8, 'start', m.start === null ? null : u32(m.start)],
        [9, 'elem', some(m.elements, element)],
        [12, 'datacount', m.dataCount === null ? null : u32(m.dataCount)],
        [10, 'code', some(m.functions, code)],
        [11, 'data', some(m.data, data)],
    ]
}

/**
 * The binary of `module`.
 *
 * @type {(module: Module) => Bytes}
 */
export const write = m => {
    /** @type {(after: SectionName | null) => Bytes} */
    const customs = after => m.customs.filter(c => c.after === after).flatMap(c => section(0, custom(c.content)))
    /** @type {(id: number, text: SectionName, content: Bytes | null | 'empty') => Bytes} */
    const known_ = (id, text, content) =>
        content === null ? []
        : content !== 'empty' ? section(id, content)
        : m.customs.some(c => c.after === text) ? section(id, vec([]))
        : []
    return [
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        ...customs(null),
        ...known(m).flatMap(([id, text, content]) => [
            ...known_(id, text, content),
            ...customs(text),
        ]),
    ]
}
