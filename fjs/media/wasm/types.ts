/**
 * The WebAssembly module AST: a module's sections as values, in the binary
 * format's terms, read by [`binary/parse`](./binary/parse/module.f.mjs) and
 * written by [`binary/write`](./binary/write/module.f.mjs) and
 * [`wat`](./wat/module.f.mjs).
 *
 * **A module is a record of its sections, not a list of them.** The known
 * sections have one order the binary format fixes, so a field each makes an
 * out-of-order module unrepresentable, and an absent section is an empty
 * field. Only custom sections may sit anywhere, so each records the known
 * section it follows.
 *
 * **A function's body is a flat instruction list**, in binary order:
 * `block`, `loop` and `if` are closed by an `end` of their own and `else`
 * stands between the arms, while the `end` closing the body itself is left
 * out. The binary is that list, and the WAT this repository prints is too, so
 * no consumer rebuilds a tree.
 *
 * **Floating-point constants are their bits**, a `number` for `f32` and a
 * `bigint` for `f64`, so a NaN's payload survives a round trip.
 *
 * **Bytes are a `readonly number[]`**, not a bit vector: a `Vec` holds 128
 * KiB, and a module Rust builds is megabytes.
 *
 * @module
 */

import type { instructions, prefixed } from './instruction/module.f.js'

/** Bytes, each a `number` from 0 to 255. */
export type Bytes = readonly number[]

export type NumType = 'i32' | 'i64' | 'f32' | 'f64'

export type RefType = 'funcref' | 'externref'

/** A value type. `v128` is the vector proposal's, which is not supported. */
export type ValType = NumType | RefType

export type FuncType = {
    readonly params: readonly ValType[]
    readonly results: readonly ValType[]
}

/** A table's or memory's size, `max` `null` where it has none. */
export type Limits = {
    readonly min: number
    readonly max: number | null
}

export type TableType = {
    readonly element: RefType
    readonly limits: Limits
}

export type GlobalType = {
    readonly type: ValType
    readonly mutable: boolean
}

/** A block's type: none, one result, or a type index. */
export type BlockType = null | ValType | number

/** A load's or store's alignment, as a power of two, and its offset. */
export type MemArg = {
    readonly align: number
    readonly offset: number
}

/** What follows each kind of opcode. */
export type Immediates = {
    readonly none: readonly []
    readonly block: readonly [BlockType]
    readonly index: readonly [number]
    readonly index2: readonly [number, number]
    readonly brTable: readonly [labels: readonly number[], default_: number]
    readonly select: readonly [readonly ValType[]]
    readonly memarg: readonly [MemArg]
    readonly i32: readonly [number]
    readonly i64: readonly [bigint]
    readonly f32: readonly [bits: number]
    readonly f64: readonly [bits: bigint]
    readonly ref: readonly [RefType]
}

export type Kind = keyof Immediates

type Row = (typeof instructions)[number] | (typeof prefixed)[number]

export type Mnemonic = Row[1]

/** An instruction: its mnemonic, then its immediates. */
export type Instruction = Row extends infer R
    ? R extends readonly [number, infer M, infer K extends Kind]
        ? readonly [M, ...Immediates[K]]
        : never
    : never

/** How an instruction is written: its opcode bytes and its immediates' kind. */
export type Encoding = readonly [readonly number[], Kind]

export type Expr = readonly Instruction[]

export type ImportDesc =
    | readonly ['func', type: number]
    | readonly ['table', TableType]
    | readonly ['memory', Limits]
    | readonly ['global', GlobalType]

export type Import = {
    readonly module: string
    readonly name: string
    readonly desc: ImportDesc
}

export type ExternKind = 'func' | 'table' | 'memory' | 'global'

export type Export = {
    readonly name: string
    readonly kind: ExternKind
    readonly index: number
}

export type Global = {
    readonly type: GlobalType
    readonly init: Expr
}

/** Locals as the binary groups them: a count of one type at a time. */
export type Locals = readonly (readonly [count: number, type: ValType])[]

/** A defined function: its type index, from the function section, and its code. */
export type Func = {
    readonly type: number
    readonly locals: Locals
    readonly body: Expr
}

export type ElementMode =
    | readonly ['passive']
    | readonly ['declarative']
    | readonly ['active', table: number, offset: Expr]

/** A segment's items: function indices, or expressions of a reference type. */
export type ElementInit =
    | readonly ['func', readonly number[]]
    | readonly ['expr', RefType, readonly Expr[]]

export type Element = {
    readonly mode: ElementMode
    readonly init: ElementInit
}

export type DataMode =
    | readonly ['passive']
    | readonly ['active', memory: number, offset: Expr]

export type Data = {
    readonly mode: DataMode
    readonly bytes: Bytes
}

/** An index and the name the name section gives it. */
export type NameMap = readonly (readonly [index: number, name: string])[]

/** A name map per index: a function's locals, say. */
export type IndirectNameMap = readonly (readonly [index: number, names: NameMap])[]

/**
 * A subsection of the name section, by its id: 0 is the module's name, 1 the
 * functions', 2 the locals', and the extended name section's 3 to 11 the
 * rest. Any other id keeps its bytes.
 */
export type NameSubsection =
    | readonly ['module', string]
    | readonly ['function' | 'type' | 'table' | 'memory' | 'global' | 'elem' | 'data' | 'tag', NameMap]
    | readonly ['local' | 'label' | 'field', IndirectNameMap]
    | readonly ['unknown', id: number, Bytes]

/** A known section, by the name the text format gives it. */
export type SectionName =
    | 'type' | 'import' | 'func' | 'table' | 'memory' | 'global' | 'export'
    | 'start' | 'elem' | 'datacount' | 'code' | 'data'

/**
 * A custom section, after the known section it follows, `null` before them
 * all. The name section is parsed; any other keeps its bytes.
 */
export type Custom = {
    readonly after: SectionName | null
    readonly content:
        | readonly ['name', readonly NameSubsection[]]
        | readonly ['raw', name: string, Bytes]
}

export type Module = {
    readonly types: readonly FuncType[]
    readonly imports: readonly Import[]
    readonly functions: readonly Func[]
    readonly tables: readonly TableType[]
    readonly memories: readonly Limits[]
    readonly globals: readonly Global[]
    readonly exports: readonly Export[]
    readonly start: number | null
    readonly elements: readonly Element[]
    readonly dataCount: number | null
    readonly data: readonly Data[]
    readonly customs: readonly Custom[]
}
