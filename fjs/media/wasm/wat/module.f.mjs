/**
 * Writes the [AST](../types.ts) as WebAssembly text (WAT), laid out as the
 * `wasmprinter` crate lays it out.
 *
 * **Line for line `wasmprinter`'s**, so a page that showed its disassembly
 * shows the same text from this: one instruction a line, indented two spaces
 * a block, each block's label as a `;; label = @N` comment and each branch's
 * target as `(;@N;)`, items named from the name section and numbered in
 * `(;N;)` comments, and floats in hexadecimal with their decimal in a
 * comment. Where the name section gives two items of a kind the same name, or
 * one no identifier can spell, the second is `$"#funcN name"` with its real
 * name in `(@name "...")`, as `wasmprinter` writes it.
 *
 * Two things of `wasmprinter`'s are not reproduced, since no module this
 * repository prints needs them: label, field and tag names, and the invented
 * syntax for the `producers` and `dylink.0` sections, which are printed as any
 * other custom section is, as their bytes.
 *
 * {@link functions} answers each defined function on its own, for a reader
 * that wants some of them: the WASM demo pages show only the functions
 * compiled from a sample.
 *
 * @module
 *
 * @import { BlockType, Bytes, Custom, Data, Element, Export, Expr, FuncType, Global, GlobalType, ImportDesc, Instruction, Limits, Locals, MemArg, Module, NameMap, NameSubsection, RefType, SectionName, TableType, ValType } from '../types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { _Context, _Names, _Naming } from './private.ts'
 */

import { reverse } from '../../../types/list/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'

// strings

/**
 * Whether `c` may stand in an identifier unquoted: a letter, a digit, or
 * one of the text format's `idchar` symbols.
 *
 * @type {(c: string) => boolean}
 */
const isIdChar = c =>
    (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
    || "!#$%&'*+-./:<=>?@\\^_`|~".includes(c)

/**
 * The contents of a string literal: printable ASCII as itself, and every
 * other code point, the quote and the backslash as `\u{...}`.
 *
 * @type {(text: string) => string}
 */
const strContents = text => Array.from(text, c => {
    const v = /** @type {number} */ (c.codePointAt(0))
    return v >= 0x20 && v < 0x7f && c !== '"' && c !== '\\' ? c : `\\u{${v.toString(16)}}`
}).join('')

/** @type {(text: string) => string} */
const str = text => `"${strContents(text)}"`

/** Bytes as a string literal, printable ASCII as itself and the rest as `\hh`. @type {(bytes: Bytes) => string} */
const bytesLiteral = bytes => `"${bytes.map(b => b >= 0x20 && b < 0x7f && b !== 0x22 && b !== 0x5c
    ? String.fromCharCode(b)
    : `\\${b.toString(16).padStart(2, '0')}`).join('')}"`

// names

/**
 * How each index of `map` is named: as itself, quoted, or with a `#` prefix
 * of `group` and the index where it is empty, starts with `#`, or was given
 * to an index before it.
 *
 * @type {(group: string) => (map: NameMap) => ReadonlyMap<number, _Naming>}
 */
const namings = group => map => {
    /** Where each name is first given, by its place in `map`. */
    const first = new Map(map.map(([, name], k) => /** @type {const} */ ([name, k])).toReversed())
    return new Map(map.map(([index, name], k) => {
        const unusable = name === '' || name.startsWith('#') || first.get(name) !== k
        /** @type {_Naming} */
        const naming = unusable ? { name, prefix: `#${group}${index}` }
            : Array.from(name).every(isIdChar) ? { name, prefix: null, quoted: false }
            : { name, prefix: null, quoted: true }
        return /** @type {const} */ ([index, naming])
    }))
}

/** @type {(naming: _Naming) => string} */
const identifier = naming =>
    naming.prefix !== null ? `$"${naming.prefix} ${strContents(naming.name)}"`
    : naming.quoted ? `$"${strContents(naming.name)}"`
    : `$${naming.name}`

/**
 * An item where it is defined: its name, if it has one, then its index.
 *
 * @type {(names: ReadonlyMap<number, _Naming>, index: number) => string}
 */
const declaration = (names, index) => {
    const naming = names.get(index)
    return naming === undefined ? `(;${index};)`
        : naming.prefix !== null ? `${identifier(naming)} (@name ${str(naming.name)}) (;${index};)`
        : `${identifier(naming)} (;${index};)`
}

/**
 * An item where it is used: its name, or its index.
 *
 * @type {(names: ReadonlyMap<number, _Naming>, index: number) => string}
 */
const reference = (names, index) => {
    const naming = names.get(index)
    return naming === undefined ? `${index}` : identifier(naming)
}

/** The empty naming of a kind the name section does not name. */
const none = new Map()

/** @type {(names: readonly NameSubsection[], key: NameSubsection[0], group: string) => ReadonlyMap<number, _Naming>} */
const mapOf = (names, key, group) => new Map(names.flatMap(s =>
    s[0] === key ? [...namings(group)(/** @type {NameMap} */ (s[1]))] : []))

/** @type {(customs: readonly Custom[]) => _Names} */
const namesOf = customs => {
    /** @type {readonly NameSubsection[]} */
    const names = customs.flatMap(({ content }) => content[0] === 'name' ? content[1] : [])
    const moduleName = names.flatMap(s => s[0] === 'module' ? [s[1]] : []).at(-1)
    return {
        module: moduleName === undefined ? null : [...namings('module')([[0, moduleName]])][0][1],
        func: mapOf(names, 'function', 'func'),
        type: mapOf(names, 'type', 'type'),
        table: mapOf(names, 'table', 'table'),
        memory: mapOf(names, 'memory', 'memory'),
        global: mapOf(names, 'global', 'global'),
        elem: mapOf(names, 'elem', 'elem'),
        data: mapOf(names, 'data', 'data'),
        local: new Map(names.flatMap(s => s[0] === 'local'
            ? s[1].map(([func, locals]) => /** @type {const} */ ([func, namings('local')(locals)]))
            : [])),
    }
}

// types

/** @type {(l: Limits) => string} */
const limits = ({ min, max }) => max === null ? `${min}` : `${min} ${max}`

/**
 * A run of parameters or locals: unnamed ones of a run in one group, each
 * named one in a group of its own.
 *
 * @type {(group: string, names: ReadonlyMap<number, _Naming>, first: number, types: readonly ValType[]) => string}
 */
const namedGroups = (group, names, first, types) => {
    /** @type {(k: number) => boolean} */
    const named = k => names.get(first + k) !== undefined
    // A group starts at each named one and at each unnamed one after a named one.
    const starts = types.flatMap((_, k) => k === 0 || named(k) || named(k - 1) ? [k] : [])
    return starts.map((start, j) => {
        const naming = names.get(first + start)
        return naming === undefined
            ? `(${group} ${types.slice(start, starts[j + 1] ?? types.length).join(' ')})`
            : `(${group} ${identifier(naming)} ${types[start]})`
    }).join(' ')
}

/** @type {(t: FuncType, params: string) => string} */
const signature = ({ results }, params) =>
    `${params === '' ? '' : ` ${params}`}${results.length === 0 ? '' : ` (result ${results.join(' ')})`}`

/** @type {(t: TableType) => string} */
const tableType = ({ element, limits: l }) => `${limits(l)} ${element}`

/** @type {(t: GlobalType) => string} */
const globalType = ({ type, mutable }) => mutable ? `(mut ${type})` : type

// floats

/**
 * A float as Rust's `Display` prints it: the shortest digits that read back
 * as the same value, in positional notation, never with an exponent.
 *
 * @type {(x: number, digits: string, exponent: number) => string}
 */
const positional = (x, digits, exponent) => {
    const sign = x < 0 ? '-' : ''
    const body = exponent >= digits.length - 1 ? digits + '0'.repeat(exponent - digits.length + 1)
        : exponent >= 0 ? `${digits.slice(0, exponent + 1)}.${digits.slice(exponent + 1)}`
        : `0.${'0'.repeat(-exponent - 1)}${digits}`
    return sign + body
}

/**
 * The shortest digits of `x` and its decimal exponent, at the precision
 * `same` accepts as reading back as `x`.
 *
 * @type {(x: number, same: (y: number) => boolean) => string}
 */
const display = (x, same) => {
    if (Number.isNaN(x)) { return 'NaN' }
    if (x === Infinity) { return 'inf' }
    if (x === -Infinity) { return '-inf' }
    if (x === 0) { return Object.is(x, -0) ? '-0' : '0' }
    const precision = Array.from({ length: 17 }, (_, k) => k + 1).find(p => same(Number(x.toPrecision(p))))
    const [mantissa, exponent] = Math.abs(x).toExponential(/** @type {number} */ (precision) - 1).split('e')
    return positional(x, mantissa.split('.').join(''), Number(exponent))
}

/**
 * The hexadecimal digits of a fraction left-aligned in `width` bits, from the
 * top, until only zeros are left.
 *
 * @type {(width: bigint, fraction: bigint) => string}
 */
const nibbles = (width, fraction) => {
    const mask = (1n << width) - 1n
    let digits = ''
    let x = fraction
    while (x > 0n) {
        digits = digits + (x >> (width - 4n)).toString(16)
        x = (x << 4n) & mask
    }
    return digits
}

/**
 * A float's bits as `wasmprinter` prints them: its sign, then hexadecimal,
 * `inf`, `nan` or `nan:0x...` for a payload other than the canonical one,
 * and its decimal in a comment.
 *
 * A subnormal is printed normalized, its exponent below the format's least,
 * and one whose fraction is a single bit as `0x1.p...`, the point with
 * nothing after it: `wasmprinter` prints the point before it finds the
 * digits gone.
 *
 * @type {(width: 32 | 64, bits: bigint) => string}
 */
const float = (width, bits) => {
    const w = BigInt(width)
    const expWidth = width === 32 ? 8n : 11n
    const mantissaWidth = w - 1n - expWidth
    const signBit = 1n << (w - 1n)
    const abs = bits & (signBit - 1n)
    const biased = abs >> mantissaWidth
    const fraction = abs & ((1n << mantissaWidth) - 1n)
    const bias = (1n << (expWidth - 1n)) - 1n
    const value = width === 32
        ? new Float32Array(new Uint32Array([Number(bits)]).buffer)[0]
        : new Float64Array(new BigUint64Array([bits]).buffer)[0]
    const decimal = width === 32
        ? display(value, y => Math.fround(y) === value)
        : display(value, y => y === value)
    const sign = (bits & signBit) !== 0n ? '-' : ''
    if (biased === (1n << expWidth) - 1n) {
        const nan = fraction === 1n << (mantissaWidth - 1n) ? 'nan' : `nan:0x${fraction.toString(16)}`
        return `${sign}${fraction === 0n ? 'inf' : nan} (;=${decimal};)`
    }
    if (abs === 0n) { return `${sign}0x0p+0 (;=${decimal};)` }
    const aligned = fraction << (w - mantissaWidth)
    // A subnormal's leading one is its fraction's first set bit, shifted out.
    const leading = w - BigInt(aligned.toString(2).length)
    const [digits, exponent] = biased !== 0n ? [aligned, biased - bias]
        : [(aligned << (leading + 1n)) & ((1n << w) - 1n), -bias - leading]
    const point = fraction === 0n ? '' : `.${nibbles(w, digits)}`
    return `${sign}0x1${point}p${exponent < 0n ? '' : '+'}${exponent} (;=${decimal};)`
}

// instructions

/** The `(type N)` of a function type, with its parameters and results. @type {(c: _Context, index: number, params: string) => string} */
const typeUse = (c, index, params) => {
    const type = c.module.types[index]
    return `(type ${reference(c.names.type, index)})${type === undefined ? '' : signature(type, params)}`
}

/** @type {(c: _Context, index: number) => string} */
const plainTypeUse = (c, index) => {
    const type = c.module.types[index]
    return typeUse(c, index, type === undefined ? '' : namedGroups('param', none, 0, type.params))
}

/** @type {(c: _Context, t: BlockType) => string} */
const blockType = (c, t) =>
    t === null ? ''
    : typeof t === 'number' ? ` ${plainTypeUse(c, t)}`
    : ` (result ${t})`

/**
 * A branch target: its relative depth, and the label it reaches as `(;@N;)`
 * unless that is the function itself.
 *
 * @type {(c: _Context, depth: number) => string}
 */
const label = (c, depth) => {
    const target = c.depth - depth
    return target < 0 ? ` ${depth} (; INVALID ;)` : target === 0 ? ` ${depth}` : ` ${depth} (;@${target};)`
}

/** The alignment a load or store has unless it says otherwise, as a power of two. @type {(mnemonic: string) => number} */
const naturalAlign = mnemonic => {
    const [type, op] = mnemonic.split('.')
    return op.endsWith('8') || op.includes('8_') ? 0
        : op.endsWith('16') || op.includes('16_') ? 1
        : op.endsWith('32') || op.includes('32_') ? 2
        : type === 'i64' || type === 'f64' ? 3
        : 2
}

/** @type {(mnemonic: string, m: MemArg) => string} */
const memarg = (mnemonic, { align, offset }) =>
    `${offset === 0 ? '' : ` offset=${offset}`}${align === naturalAlign(mnemonic) ? '' : ` align=${2 ** align}`}`

/** A `call_indirect`'s type: the reference alone, without its signature. @type {(c: _Context, index: number) => string} */
const typeUseRef = (c, index) => `(type ${reference(c.names.type, index)})`

/** @type {(t: RefType) => string} */
const heapType = t => t === 'funcref' ? 'func' : 'extern'

/**
 * An instruction's text after its mnemonic.
 *
 * @type {(c: _Context, x: Instruction) => string}
 */
const operands = (c, x) => {
    const { names } = c
    /** @type {(space: keyof _Names, index: number) => string} */
    const ref = (space, index) => ` ${reference(/** @type {ReadonlyMap<number, _Naming>} */ (names[space]), index)}`
    /** @type {(index: number) => string} */
    const memory = index => index === 0 ? '' : ref('memory', index)
    switch (x[0]) {
        case 'block': case 'loop': case 'if':
            return `${blockType(c, x[1])} ;; label = @${c.depth + 1}`
        case 'br': case 'br_if':
            return label(c, x[1])
        case 'br_table':
            return [...x[1], x[2]].map(d => label(c, d)).join('')
        case 'call': case 'ref.func':
            return ref('func', x[1])
        case 'call_indirect':
            return `${x[2] === 0 ? '' : ref('table', x[2])} ${typeUseRef(c, x[1])}`
        case 'local.get': case 'local.set': case 'local.tee':
            return ` ${reference(c.locals, x[1])}`
        case 'global.get': case 'global.set':
            return ref('global', x[1])
        case 'table.get': case 'table.set': case 'table.grow': case 'table.size': case 'table.fill':
            return ref('table', x[1])
        case 'memory.size': case 'memory.grow': case 'memory.fill':
            return memory(x[1])
        case 'memory.init':
            return `${memory(x[2])}${ref('data', x[1])}`
        case 'memory.copy':
            return x[1] === 0 && x[2] === 0 ? '' : `${ref('memory', x[1])}${ref('memory', x[2])}`
        case 'data.drop':
            return ref('data', x[1])
        case 'table.init':
            return `${x[2] === 0 ? '' : ref('table', x[2])}${ref('elem', x[1])}`
        case 'elem.drop':
            return ref('elem', x[1])
        case 'table.copy':
            return x[1] === 0 && x[2] === 0 ? '' : `${ref('table', x[1])}${ref('table', x[2])}`
        case 'select':
            return x.length === 1 ? '' : ` (result${x[1].map(t => ` ${t}`).join('')})`
        case 'i32.const': case 'i64.const':
            return ` ${x[1]}`
        case 'f32.const':
            return ` ${float(32, BigInt(x[1]))}`
        case 'f64.const':
            return ` ${float(64, x[1])}`
        case 'ref.null':
            return ` ${heapType(x[1])}`
        default:
            return x.length === 2 ? memarg(x[0], x[1]) : ''
    }
}

/** @type {(c: _Context, x: Instruction) => string} */
const instruction = (c, x) => `${x[0]}${operands(c, x)}`

/**
 * An expression's instructions on one line each, indented from `nesting` by
 * the blocks open around them: a block's opening at the depth outside it,
 * its `else` and `end` there too.
 *
 * @type {(c: _Context, nesting: number, body: Expr) => readonly string[]}
 */
const lines = (c, nesting, body) => {
    /** @type {List<string>} */
    let result = null
    let depth = 0
    for (const x of body) {
        const closing = x[0] === 'end' || x[0] === 'else'
        const at = closing && depth > 0 ? depth - 1 : depth
        result = { first: `${indentation(nesting + at)}${instruction({ ...c, depth }, x)}`, tail: result }
        depth = x[0] === 'end' ? at
            : x[0] === 'block' || x[0] === 'loop' || x[0] === 'if' ? depth + 1
            : depth
    }
    return toArray(reverse(result))
}

/**
 * Two spaces a level, up to fifty levels: `wasmprinter` stops there, so a
 * deeply nested function does not take megabytes of spaces.
 *
 * @type {(nesting: number) => string}
 */
const indentation = nesting => '  '.repeat(Math.min(nesting, 50))

/**
 * A constant expression on one line, its instructions space-separated.
 *
 * @type {(c: _Context, e: Expr) => string}
 */
const constExpr = (c, e) => e.map(x => instruction(c, x)).join(' ')

/**
 * A constant expression in parentheses: alone where it is one instruction,
 * after `keyword` where it is more.
 *
 * @type {(c: _Context, keyword: string, e: Expr) => string}
 */
const sugar = (c, keyword, e) => e.length === 1 ? `(${constExpr(c, e)})` : `(${keyword} ${constExpr(c, e)})`

// the module

/**
 * The place a custom section is printed with: after the last section before
 * it the module has, the data count aside, which has no text.
 *
 * @type {(m: Module, after: SectionName | null) => string}
 */
const place = (m, after) => {
    /** @type {readonly (readonly [SectionName, boolean])[]} */
    const present = [
        ['type', m.types.length > 0],
        ['import', m.imports.length > 0],
        ['func', m.functions.length > 0],
        ['table', m.tables.length > 0],
        ['memory', m.memories.length > 0],
        ['global', m.globals.length > 0],
        ['export', m.exports.length > 0],
        ['start', m.start !== null],
        ['elem', m.elements.length > 0],
        ['datacount', false],
        ['code', m.functions.length > 0],
        ['data', m.data.length > 0],
    ]
    const upTo = after === null ? [] : present.slice(0, present.findIndex(([name]) => name === after) + 1)
    const last = upTo.filter(([, has]) => has).at(-1)
    return last === undefined ? 'before first' : `after ${last[0]}`
}

/** How many of each kind the imports hold. @type {(m: Module, kind: ImportDesc[0]) => number} */
const imported = (m, kind) => m.imports.filter(({ desc }) => desc[0] === kind).length

/** @type {(c: _Context) => readonly string[]} */
const types = c => c.module.types.map((t, k) =>
    `(type ${declaration(c.names.type, k)} (func${signature(t, namedGroups('param', none, 0, t.params))}))`)

/** @type {(c: _Context) => readonly string[]} */
const imports = c => {
    const { module: m, names } = c
    /** @type {(kind: ImportDesc[0], k: number) => number} */
    const index = (kind, k) => imported({ ...m, imports: m.imports.slice(0, k) }, kind)
    return m.imports.map(({ module, name, desc }, k) => {
        const d = desc[0] === 'func' ? (() => {
            const i = index('func', k)
            const params = c.module.types[desc[1]]?.params ?? []
            return `func ${declaration(names.func, i)} ${typeUse(c, desc[1], namedGroups('param', names.local.get(i) ?? none, 0, params))}`
        })()
            : desc[0] === 'table' ? `table ${declaration(names.table, index('table', k))} ${tableType(desc[1])}`
            : desc[0] === 'memory' ? `memory ${declaration(names.memory, index('memory', k))} ${limits(desc[1])}`
            : `global ${declaration(names.global, index('global', k))} ${globalType(desc[1])}`
        return `(import ${str(module)} ${str(name)} (${d}))`
    })
}

/**
 * A defined function: its header, its locals, its body, and the closing
 * parenthesis on a line of its own, each line indented as in a module.
 *
 * @type {(c: _Context, k: number) => readonly string[]}
 */
const func = (c, k) => {
    const { module: m, names } = c
    const { type, locals, body } = m.functions[k]
    const index = imported(m, 'func') + k
    const localNames = names.local.get(index) ?? none
    const params = m.types[type]?.params ?? []
    const header = `  (func ${declaration(names.func, index)} ${typeUse(c, type, namedGroups('param', localNames, 0, params))}`
    /** @type {readonly ValType[]} */
    const flat = locals.flatMap(([count, t]) => Array.from({ length: count }, () => t))
    const inner = [
        ...(flat.length === 0 ? [] : [`    ${namedGroups('local', localNames, params.length, flat)}`]),
        ...lines({ ...c, locals: localNames }, 2, body),
    ]
    return inner.length === 0 ? [`${header})`] : [header, ...inner, '  )']
}

/** @type {(c: _Context, e: Element, k: number) => string} */
const element = (c, { mode, init }, k) => {
    const implicit = mode[0] === 'active' && mode[1] === 0 && (init[0] === 'func' || init[1] === 'funcref')
    const modeText = mode[0] === 'passive' ? ''
        : mode[0] === 'declarative' ? ' declare'
        : `${implicit ? '' : ` (table ${reference(c.names.table, mode[1])})`} ${sugar(c, 'offset', mode[2])}`
    const items = init[0] === 'func'
        ? ['func', ...init[1].map(i => reference(c.names.func, i))].join(' ')
        : [init[1], ...init[2].map(e => sugar(c, 'item', e))].join(' ')
    return `(elem ${declaration(c.names.elem, k)}${modeText} ${items})`
}

/** @type {(c: _Context, d: Data, k: number) => string} */
const data = (c, { mode, bytes }, k) => {
    const modeText = mode[0] === 'passive' ? ''
        : `${mode[1] === 0 ? '' : `(memory ${reference(c.names.memory, mode[1])}) `}${sugar(c, 'offset', mode[2])} `
    return `(data ${declaration(c.names.data, k)} ${modeText}${bytesLiteral(bytes)})`
}

/** @type {(m: Module) => _Context} */
const context = m => ({ module: m, names: namesOf(m.customs), locals: none, depth: 0 })

/**
 * The WAT of each function the module defines, in order: the lines from its
 * `(func` to its closing parenthesis, each ending in a newline, as they stand
 * in the module's WAT.
 *
 * @type {(module: Module) => readonly string[]}
 */
export const functions = m => {
    const c = context(m)
    return m.functions.map((_, k) => func(c, k).map(line => `${line}\n`).join(''))
}

/**
 * The module's WAT: its sections in the order the binary has them, each
 * custom section after the one it follows, the name section aside, which
 * names the rest.
 *
 * @type {(module: Module) => string}
 */
export const wat = m => {
    const c = context(m)
    const { names } = c
    const globalsBase = imported(m, 'global')
    /** @type {(after: SectionName | null) => readonly string[]} */
    const customs = after => m.customs.flatMap(({ after: a, content }) => a !== after || content[0] === 'name' ? []
        : [`  (@custom ${str(content[1])} (${place(m, a)}) ${bytesLiteral(content[2])})`])
    /** @type {(text: SectionName, items: readonly string[]) => readonly string[]} */
    const section = (text, items) => [...items.map(item => `  ${item}`), ...customs(text)]
    const tablesBase = imported(m, 'table')
    const memoriesBase = imported(m, 'memory')
    const body = [
        ...customs(null),
        ...section('type', types(c)),
        ...section('import', imports(c)),
        ...customs('func'),
        ...section('table', m.tables.map((t, k) => `(table ${declaration(names.table, tablesBase + k)} ${tableType(t)})`)),
        ...section('memory', m.memories.map((l, k) => `(memory ${declaration(names.memory, memoriesBase + k)} ${limits(l)})`)),
        ...section('global', m.globals.map(({ type, init }, k) =>
            `(global ${declaration(names.global, globalsBase + k)} ${globalType(type)} ${constExpr(c, init)})`)),
        ...section('export', m.exports.map(({ name, kind, index }) =>
            `(export ${str(name)} (${kind} ${reference(names[kind], index)}))`)),
        ...section('start', m.start === null ? [] : [`(start ${reference(names.func, m.start)})`]),
        ...section('elem', m.elements.map((e, k) => element(c, e, k))),
        ...customs('datacount'),
        ...m.functions.flatMap((_, k) => func(c, k)),
        ...customs('code'),
        ...section('data', m.data.map((d, k) => data(c, d, k))),
    ]
    const header = `(module${names.module === null ? '' : ` ${identifier(names.module)}`}`
    return body.length === 0 ? `${header})\n` : [header, ...body, ')'].map(line => `${line}\n`).join('')
}
