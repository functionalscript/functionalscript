/**
 * Parses a binary WebAssembly module into the [AST](../../types.ts).
 *
 * **It refuses what it cannot represent, and says where.** An opcode outside
 * [the instruction table](../../instruction/module.f.mjs), a value type or
 * limits flag of an unsupported proposal, a malformed integer or name, a
 * section out of order, past the end or not filling its size, a function
 * count the code section does not match: each is an error naming the byte it
 * was found at, never an instruction skipped or a section dropped.
 *
 * **It reads the format, not the semantics.** A module that decodes is
 * answered whether or not it would validate: an index out of range, a type
 * mismatch or an `else` outside an `if` is the validator's to refuse, and
 * this is no validator.
 *
 * The name section is parsed into its subsections, and every other custom
 * section kept as its bytes, each with the known section it follows.
 *
 * @module
 *
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { BlockType, Bytes, Custom, Data, Element, ElementInit, Export, ExternKind, FuncType, Global, GlobalType, Immediates, Import, ImportDesc, IndirectNameMap, Instruction, Kind, Limits, Module, NameMap, NameSubsection, RefType, SectionName, TableType, ValType } from '../../types.ts'
 * @import { Code, Read, Sections } from './private.ts'
 */

import { error, ok } from '../../../../types/result/module.f.js'
import { reverse, toArray } from '../../../../types/list/module.f.mjs'
import { fromU8List } from '../../../../text/utf8/module.f.mjs'
import { afterPrefix, prefix, single } from '../../instruction/module.f.mjs'

// readers

/** @type {(i: number, message: string) => Result<never, string>} */
const fail = (i, message) => error(`${message} at byte ${i}`)

/** @type {<T>(v: T) => Read<T>} */
const pure = v => (_, i) => ok([v, i])

/**
 * `p`, then the reader `f` makes of what it read.
 *
 * @type {<A, B>(p: Read<A>, f: (a: A) => Read<B>) => Read<B>}
 */
const then = (p, f) => (b, i) => {
    const r = p(b, i)
    if (r[0] === 'error') { return r }
    const [a, j] = r[1]
    return f(a)(b, j)
}

/** @type {<A, B>(p: Read<A>, f: (a: A) => B) => Read<B>} */
const map = (p, f) => then(p, a => pure(f(a)))

/** @type {Read<number>} */
const byte = (b, i) => i < b.length ? ok([b[i], i + 1]) : fail(i, 'unexpected end')

/**
 * `n` bytes.
 *
 * @type {(n: number) => Read<Bytes>}
 */
const bytes = n => (b, i) => i + n <= b.length ? ok([b.slice(i, i + n), i + n]) : fail(i, 'unexpected end')

/**
 * A LEB128 integer of `bits` bits, as the binary format writes them: in at
 * most `ceil(bits / 7)` bytes, its value in range.
 *
 * @type {(bits: number, signed: boolean) => Read<bigint>}
 */
const leb = (bits, signed) => (b, i) => {
    const maxBytes = Math.ceil(bits / 7)
    let v = 0n
    let shift = 0n
    let j = i
    while (true) {
        if (j - i === maxBytes) { return fail(i, 'integer representation too long') }
        if (j >= b.length) { return fail(j, 'unexpected end') }
        const x = b[j]
        j = j + 1
        v = v | (BigInt(x & 0x7f) << shift)
        shift = shift + 7n
        if ((x & 0x80) === 0) { break }
    }
    const value = signed && ((v >> (shift - 1n)) & 1n) === 1n ? v - (1n << shift) : v
    const limit = 1n << BigInt(signed ? bits - 1 : bits)
    return value >= limit || value < -limit ? fail(i, 'integer out of range') : ok([value, j])
}

/** @type {Read<number>} */
const u32 = map(leb(32, false), Number)

/** @type {Read<number>} */
const s32 = map(leb(32, true), Number)

/** @type {Read<bigint>} */
const s64 = leb(64, true)

/** @type {Read<bigint>} */
const s33 = leb(33, true)

/**
 * A little-endian integer of `n` bytes.
 *
 * @type {(n: number) => Read<bigint>}
 */
const fixed = n => map(bytes(n), x => x.reduceRight((v, byte) => (v << 8n) | BigInt(byte), 0n))

/** @type {Read<number>} */
const f32 = map(fixed(4), Number)

/** @type {Read<bigint>} */
const f64 = fixed(8)

/**
 * A count, then that many of what `p` reads.
 *
 * @type {<T>(p: Read<T>) => Read<readonly T[]>}
 */
const vec = p => then(u32, n => (b, i) => {
    /** @type {List<any>} */
    let items = null
    let j = i
    for (let k = 0; k < n; k = k + 1) {
        const r = p(b, j)
        if (r[0] === 'error') { return r }
        items = { first: r[1][0], tail: items }
        j = r[1][1]
    }
    return ok([toArray(reverse(items)), j])
})

/** @type {Read<string>} */
const name = then(u32, n => (b, i) => {
    const r = bytes(n)(b, i)
    if (r[0] === 'error') { return r }
    const text = fromU8List(r[1][0])
    return text === null ? fail(i, 'malformed UTF-8') : ok([text, r[1][1]])
})

/**
 * One byte, answered by `table`, or refused as `what`.
 *
 * @type {<T>(what: string, table: Readonly<Record<number, T>>) => Read<T>}
 */
const tag = (what, table) => (b, i) => {
    const r = byte(b, i)
    if (r[0] === 'error') { return r }
    const [x, j] = r[1]
    return x in table ? ok([table[x], j]) : fail(i, `unsupported ${what} 0x${x.toString(16)}`)
}

// types

/** @type {Readonly<Record<number, RefType>>} */
const refTypes = { 0x70: 'funcref', 0x6f: 'externref' }

/** @type {Readonly<Record<number, ValType>>} */
const valTypes = { 0x7f: 'i32', 0x7e: 'i64', 0x7d: 'f32', 0x7c: 'f64', ...refTypes }

/** @type {Read<ValType>} */
const valType = tag('value type', valTypes)

/** @type {Read<RefType>} */
const refType = tag('reference type', refTypes)

/** @type {Read<FuncType>} */
const funcType = then(
    tag('type form', { 0x60: null }),
    () => then(vec(valType), params => map(vec(valType), results => ({ params, results }))))

/** @type {Read<Limits>} */
const limits = then(
    tag('limits flag', { 0: false, 1: true }),
    hasMax => then(u32, min => hasMax
        ? map(u32, max => /** @type {Limits} */ ({ min, max }))
        : pure(/** @type {Limits} */ ({ min, max: null }))))

/** @type {Read<TableType>} */
const tableType = then(refType, element => map(limits, limits => ({ element, limits })))

/** @type {Read<GlobalType>} */
const globalType = then(valType, type => map(tag('mutability', { 0: false, 1: true }), mutable => ({ type, mutable })))

// instructions

/** @type {Read<BlockType>} */
const blockType = (b, i) =>
    b[i] === 0x40 ? ok([null, i + 1])
    : b[i] in valTypes ? valType(b, i)
    : then(s33, x => x < 0n ? () => fail(i, 'malformed block type') : pure(Number(x)))(b, i)

/** @type {{ readonly [K in Kind]: Read<Immediates[K]> }} */
const immediates = {
    none: pure(/** @type {const} */ ([])),
    block: map(blockType, t => /** @type {const} */ ([t])),
    index: map(u32, x => /** @type {const} */ ([x])),
    index2: then(u32, x => map(u32, y => /** @type {const} */ ([x, y]))),
    brTable: then(vec(u32), labels => map(u32, d => /** @type {const} */ ([labels, d]))),
    select: map(vec(valType), types => /** @type {const} */ ([types])),
    memarg: then(u32, align => (b, i) => align >= 0x40
        ? fail(i, 'multiple memories are not supported')
        : map(u32, offset => /** @type {const} */ ([{ align, offset }]))(b, i)),
    i32: map(s32, x => /** @type {const} */ ([x])),
    i64: map(s64, x => /** @type {const} */ ([x])),
    f32: map(f32, x => /** @type {const} */ ([x])),
    f64: map(f64, x => /** @type {const} */ ([x])),
    ref: map(refType, t => /** @type {const} */ ([t])),
}

/** @type {Read<Instruction>} */
const instruction = (b, i) => {
    const opcode = byte(b, i)
    if (opcode[0] === 'error') { return opcode }
    const [code, j] = opcode[1]
    const sub = code === prefix ? u32(b, j) : ok(/** @type {const} */ ([code, j]))
    if (sub[0] === 'error') { return sub }
    const [index, k] = sub[1]
    const row = (code === prefix ? afterPrefix : single)[index]
    if (row === undefined) {
        return fail(i, `unknown opcode 0x${code === prefix ? `fc ${index}` : code.toString(16)}`)
    }
    const [, mnemonic, kind] = row
    /** @type {Read<readonly unknown[]>} */
    const read = immediates[kind]
    // `immediates[kind]` reads the immediates of the row's kind, so the tuple
    // is one of the row's instructions.
    return map(read, x => /** @type {Instruction} */ (/** @type {unknown} */ ([mnemonic, ...x])))(b, k)
}

/**
 * Instructions up to the `end` that closes the expression, which is read and
 * left out.
 *
 * @type {Read<readonly Instruction[]>}
 */
const expr = (b, i) => {
    /** @type {List<Instruction>} */
    let items = null
    let depth = 0
    let j = i
    while (true) {
        const r = instruction(b, j)
        if (r[0] === 'error') { return r }
        const [x, next] = r[1]
        j = next
        if (x[0] === 'end') {
            if (depth === 0) { break }
            depth = depth - 1
        }
        if (x[0] === 'block' || x[0] === 'loop' || x[0] === 'if') { depth = depth + 1 }
        items = { first: x, tail: items }
    }
    return ok([toArray(reverse(items)), j])
}

// sections

/** @type {Readonly<Record<number, ExternKind>>} */
const externKinds = { 0: 'func', 1: 'table', 2: 'memory', 3: 'global' }

/** @type {(kind: ExternKind) => Read<ImportDesc>} */
const importDesc = kind =>
    kind === 'func' ? map(u32, x => /** @type {ImportDesc} */ (['func', x]))
    : kind === 'table' ? map(tableType, x => /** @type {ImportDesc} */ (['table', x]))
    : kind === 'memory' ? map(limits, x => /** @type {ImportDesc} */ (['memory', x]))
    : map(globalType, x => /** @type {ImportDesc} */ (['global', x]))

/** @type {Read<Import>} */
const import_ = then(name, module => then(name, name => map(
    then(tag('import kind', externKinds), importDesc),
    desc => ({ module, name, desc }))))

/** @type {Read<Global>} */
const global = then(globalType, type => map(expr, init => ({ type, init })))

/** @type {Read<Export>} */
const export_ = then(name, name => then(tag('export kind', externKinds), kind => map(u32, index => ({ name, kind, index }))))

/** @type {Read<ElementInit>} */
const funcs = then(tag('element kind', { 0: null }), () => map(vec(u32), x => /** @type {const} */ (['func', x])))

/** @type {(type: RefType) => Read<ElementInit>} */
const exprs = type => map(vec(expr), x => /** @type {const} */ (['expr', type, x]))

/** @type {Read<ElementInit>} */
const typedExprs = then(refType, exprs)

/**
 * A segment of each of the eight encodings: bit 0 passive or declarative,
 * bit 1 an explicit table (when active) or declarative (when not), bit 2
 * expressions rather than function indices.
 *
 * @type {Read<Element>}
 */
const element = (b, i) => then(u32, flag => {
    /** @type {(mode: Read<Element['mode']>, init: Read<ElementInit>) => Read<Element>} */
    const segment = (mode, init) => then(mode, mode => map(init, init => ({ mode, init })))
    /** @type {(table: number) => Read<Element['mode']>} */
    const active = table => map(expr, offset => /** @type {const} */ (['active', table, offset]))
    const passive = pure(/** @type {const} */ (['passive']))
    const declarative = pure(/** @type {const} */ (['declarative']))
    return flag === 0 ? segment(active(0), map(vec(u32), x => /** @type {const} */ (['func', x])))
        : flag === 1 ? segment(passive, funcs)
        : flag === 2 ? segment(then(u32, active), funcs)
        : flag === 3 ? segment(declarative, funcs)
        : flag === 4 ? segment(active(0), exprs('funcref'))
        : flag === 5 ? segment(passive, typedExprs)
        : flag === 6 ? segment(then(u32, active), typedExprs)
        : flag === 7 ? segment(declarative, typedExprs)
        : () => fail(i, `unsupported element segment flag ${flag}`)
})(b, i)

/** @type {Read<Bytes>} */
const dataBytes = then(u32, bytes)

/** @type {Read<Data>} */
const data = (b, i) => then(u32, flag => {
    /** @type {(memory: number) => Read<Data>} */
    const active = memory => then(expr, offset => map(dataBytes, bytes => ({ mode: /** @type {const} */ (['active', memory, offset]), bytes })))
    return flag === 0 ? active(0)
        : flag === 1 ? map(dataBytes, bytes => ({ mode: /** @type {const} */ (['passive']), bytes }))
        : flag === 2 ? then(u32, active)
        : () => fail(i, `unsupported data segment flag ${flag}`)
})(b, i)

/**
 * What `p` reads from `size` bytes, refused unless it reads exactly those.
 * `p` is not stopped at the boundary: a reader that crosses it ends somewhere
 * else, which is the same refusal.
 *
 * @type {<T>(what: string, p: Read<T>) => (size: number) => Read<T>}
 */
const sized = (what, p) => size => (b, i) => {
    const end = i + size
    if (end > b.length) { return fail(i, `${what} extends past the end`) }
    const r = p(b, i)
    if (r[0] === 'error') { return r }
    return r[1][1] === end ? r : fail(end, `${what} size mismatch`)
}

/** @type {Read<Code>} */
const code = then(u32, sized('function body', then(
    vec(then(u32, count => map(valType, type => /** @type {const} */ ([count, type])))),
    locals => map(expr, body => ({ locals, body })))))

// names

/** @type {Read<NameMap>} */
const nameMap = vec(then(u32, index => map(name, name => /** @type {const} */ ([index, name]))))

/** @type {Read<IndirectNameMap>} */
const indirectNameMap = vec(then(u32, index => map(nameMap, names => /** @type {const} */ ([index, names]))))

/** The name subsections, by id. */
const nameIds = /** @type {const} */ ([
    'module', 'function', 'local', 'label', 'type', 'table', 'memory', 'global', 'elem', 'data', 'field', 'tag',
])

/** @type {Read<NameSubsection>} */
const nameSubsection = then(byte, id => then(u32, size => {
    const key = nameIds[id]
    return sized('name subsection', key === 'module' ? map(name, x => /** @type {NameSubsection} */ (['module', x]))
        : key === 'local' || key === 'label' || key === 'field' ? map(indirectNameMap, x => /** @type {NameSubsection} */ ([key, x]))
        : key === undefined ? map(bytes(size), x => /** @type {NameSubsection} */ (['unknown', id, x]))
        : map(nameMap, x => /** @type {NameSubsection} */ ([key, x])))(size)
}))

/**
 * Subsections until `end`.
 *
 * @type {(end: number) => Read<readonly NameSubsection[]>}
 */
const nameSubsections = end => (b, i) => {
    /** @type {List<NameSubsection>} */
    let items = null
    let j = i
    while (j < end) {
        const r = nameSubsection(b, j)
        if (r[0] === 'error') { return r }
        items = { first: r[1][0], tail: items }
        j = r[1][1]
    }
    return ok([toArray(reverse(items)), j])
}

/** @type {(size: number) => Read<Custom['content']>} */
const custom = size => (b, i) => then(name, n => (b, j) => n === 'name'
    ? map(nameSubsections(i + size), x => /** @type {Custom['content']} */ (['name', x]))(b, j)
    : map(bytes(i + size - j), x => /** @type {Custom['content']} */ (['raw', n, x]))(b, j))(b, i)

// the module

/**
 * Each known section by id: its text name and what it reads.
 *
 * @type {Readonly<Record<number, readonly [SectionName, Read<Partial<Sections>>]>>}
 */
const known = {
    1: ['type', map(vec(funcType), types => ({ types }))],
    2: ['import', map(vec(import_), imports => ({ imports }))],
    3: ['func', map(vec(u32), funcs => ({ funcs }))],
    4: ['table', map(vec(tableType), tables => ({ tables }))],
    5: ['memory', map(vec(limits), memories => ({ memories }))],
    6: ['global', map(vec(global), globals => ({ globals }))],
    7: ['export', map(vec(export_), exports => ({ exports }))],
    8: ['start', map(u32, start => ({ start }))],
    9: ['elem', map(vec(element), elements => ({ elements }))],
    10: ['code', map(vec(code), code => ({ code }))],
    11: ['data', map(vec(data), data => ({ data }))],
    12: ['datacount', map(u32, dataCount => ({ dataCount }))],
}

/** The order the known sections must come in, by id: the data count before the code. */
const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 10, 11]

/** @type {Sections} */
const empty = {
    types: [], imports: [], funcs: [], tables: [], memories: [], globals: [], exports: [],
    start: null, elements: [], dataCount: null, code: [], data: [],
}

/**
 * The module `bytes` encode, or why they do not.
 *
 * @type {(bytes: Bytes) => Result<Module, string>}
 */
export const parse = b => {
    const magic = [0x00, 0x61, 0x73, 0x6d]
    const version = [0x01, 0x00, 0x00, 0x00]
    if (magic.some((x, k) => b[k] !== x)) { return fail(0, 'not a WebAssembly module') }
    if (version.some((x, k) => b[4 + k] !== x)) { return fail(4, 'unsupported WebAssembly version') }
    let sections = empty
    /** @type {List<Custom>} */
    let customs = null
    /** @type {SectionName | null} */
    let after = null
    let rank = -1
    let i = 8
    while (i < b.length) {
        const id = b[i]
        const size = u32(b, i + 1)
        if (size[0] === 'error') { return size }
        const [n, start] = size[1]
        if (id === 0) {
            const r = sized('section', custom(n))(n)(b, start)
            if (r[0] === 'error') { return r }
            customs = { first: { after, content: r[1][0] }, tail: customs }
            i = r[1][1]
            continue
        }
        const section = known[id]
        if (section === undefined) { return fail(i, `unknown section id ${id}`) }
        const next = order.indexOf(id)
        if (next <= rank) { return fail(i, `${section[0]} section out of order`) }
        const r = sized(`${section[0]} section`, section[1])(n)(b, start)
        if (r[0] === 'error') { return r }
        sections = { ...sections, ...r[1][0] }
        after = section[0]
        rank = next
        i = r[1][1]
    }
    const { funcs, code, ...rest } = sections
    if (funcs.length !== code.length) {
        return fail(i, `function and code section counts differ (${funcs.length} and ${code.length})`)
    }
    if (rest.dataCount !== null && rest.dataCount !== rest.data.length) {
        return fail(i, `data count and data section count differ (${rest.dataCount} and ${rest.data.length})`)
    }
    return ok({
        ...rest,
        functions: funcs.map((type, k) => ({ type, ...code[k] })),
        customs: toArray(reverse(customs)),
    })
}
