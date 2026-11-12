// @ts-nocheck
// A prototype of one slice of the planned IR (doc/sasha-gil/ir/type-system.md):
// the types, `bits` layouts in the notation of the NaN VM README, the proofs
// of a layout, what a layout derives, and an evaluator for expressions.
//
// It is not the IR. It has no range checker, no lifetime pass and no
// lowering. Where the checker would use a range, the evaluator tests the
// value at run time instead. It accompanies nan-box-in-ir.md, which says
// what it found. The tsconfig checks every .mjs, and this prototype is
// plain JavaScript without types, so it opts out with the line above.

// Exported only so that the declarations which the repository's tsc emits
// can name them.
export const TYPE = Symbol('type')
export const NODE = Symbol('node')
export const STATIC = Symbol('static type')
export const VALUE = Symbol('value')

/** A trap of the program: defined behaviour. */
export class Trap extends Error {}
/** What the checker refuses: a mistake in the code or in a layout. */
export class Refused extends Error {}
const refuse = message => { throw new Refused(message) }

// ── Types ────────────────────────────────────────────────────────────────

const type = (kind, props = {}) => {
    const t = { [TYPE]: kind, ...props }
    // `T.of(start)` declares a loop parameter
    Object.defineProperty(t, 'of', { value: start => ({ [TYPE]: 'loop parameter', type: t, start }) })
    return t
}
/** A type declared later is written as a thunk, as in RTTI. */
const resolve = t => { while (typeof t === 'function') { t = t() } return t }
const kindOf = t => t === undefined ? undefined : resolve(t)[TYPE] ?? 'product'

const range = (lo, hi) => type('int', { lo, hi })
export const int = (lo, hi) => {
    if (lo > hi) { refuse(`int(${lo}, ${hi}) is empty`) }
    if (lo < -(1n << 127n) || hi >= 1n << 128n) { refuse('an integer type holds at most 128 bits') }
    return range(lo, hi)
}
export const u = n => int(0n, (1n << BigInt(n)) - 1n)
export const i = n => int(-(1n << BigInt(n - 1)), (1n << BigInt(n - 1)) - 1n)
export const u16 = u(16)
export const u64 = u(64)
export const i64 = i(64)
export const f64 = type('f64')
export const f64c = type('f64c')
// The prelude's `bool`. As a field it is one bit, 0 for false.
export const bool = type('bool')
export const unit = {}
const never = type('never')
export const array = (item, n) => type('array', { item, n })
/** A new type with the values of `base`. It is never converted implicitly. */
export const named = (name, base) => type('named', { name, base })
export const tail = (item, len) => type('tail', { item, len })
export const object = (name, fields) => type('object', { name, fields })
export const code = (params, result) => type('code', { params, result })
const reference = mode => o => type('reference', { mode, o })
export const ref = reference('ref')
export const uniq = reference('uniq')
export const stat = reference('stat')
export const view = reference('view')
export const own = t => type('own', { type: t })
const unOwn = t => kindOf(t) === 'own' ? resolve(t).type : t

const bitLength = n => n === 0n ? 0 : n.toString(2).length
/** The width of a type as a field. A reference has none: its pattern gives it. */
const widthOf = t => {
    t = resolve(t)
    switch (kindOf(t)) {
        case 'int': {
            if (t.lo >= 0n) { return bitLength(t.hi) }
            let n = 1
            while (t.lo < -(1n << BigInt(n - 1)) || t.hi >= 1n << BigInt(n - 1)) { n++ }
            return n
        }
        case 'bool': return 1
        case 'named': return widthOf(t.base)
        case 'sum': return t.layout === 'bits' ? t.width : refuse('a sum is a field only with declared bits')
        case 'array': return t.n * widthOf(t.item)
        case 'reference': return undefined
        default: return refuse(`a ${kindOf(t)} cannot be a field`)
    }
}

// ── Run-time values of the evaluator ─────────────────────────────────────

// integers are bigints, floats numbers, booleans booleans, arrays arrays and
// products objects. A sum with declared bits is its carrier and nothing else.
const bitsValue = bits => ({ [VALUE]: 'bits', bits })
const sumValue = (tag, payload) => ({ [VALUE]: 'sum', tag, payload })
const refValue = (mode, obj) => ({ [VALUE]: 'reference', mode, obj })
const tailValue = obj => ({ [VALUE]: 'tail', obj })
/** The carrier of a value of a `bits` type, for the host and the proofs. */
export const carrier = v => v.bits
export const fromCarrier = bitsValue

const heap = new Map()
let nextAddress = 0x1000n
const newObject = (o, fields, capacity) => {
    const obj = { o, fields, items: [], capacity, frozen: false, address: nextAddress }
    nextAddress += 16n + 8n * capacity
    heap.set(obj.address, obj)
    return obj
}

const ones = n => (1n << BigInt(n)) - 1n
const enc = (t, v, w) => {
    t = resolve(t)
    switch (kindOf(t)) {
        case 'int': return BigInt.asUintN(w, v)
        case 'named': return enc(t.base, v, w)
        case 'bool': return v ? 1n : 0n
        case 'sum': return v.bits
        case 'array': {
            // item 0 is in the lowest bits
            const iw = widthOf(t.item)
            return v.reduce((acc, x, k) => acc | enc(t.item, x, iw) << BigInt(iw * k), 0n)
        }
        // a reference field holds the address without its two alignment bits
        case 'reference': return v.obj.address >> 2n
        default: return refuse(`a ${kindOf(t)} cannot be a field`)
    }
}
const dec = (t, b, w) => {
    t = resolve(t)
    switch (kindOf(t)) {
        case 'int': return t.lo < 0n ? BigInt.asIntN(w, b) : b
        case 'named': return dec(t.base, b, w)
        case 'bool': return b === 1n
        case 'sum': return bitsValue(b)
        case 'array': {
            const iw = widthOf(t.item)
            return Array.from({ length: t.n }, (_, k) => dec(t.item, b >> BigInt(iw * k) & ones(iw), iw))
        }
        case 'reference': return refValue(t.mode, heap.get(b << 2n))
        default: return refuse(`a ${kindOf(t)} cannot be a field`)
    }
}

// ── Patterns ─────────────────────────────────────────────────────────────

/**
 * A pattern as `total` characters. `0` and `1` are fixed bits, a letter is a
 * bit of a field, `_` is a separator, and `…` repeats the character before
 * it. A field's width comes from its type, so one fill at most is counted
 * from what is left: a fill of fixed bits, or of a field that has no width
 * of its own.
 */
export const expand = (pattern, total, widths = {}) => {
    const s = pattern.replaceAll('_', '')
    const items = []
    for (let k = 0; k < s.length;) {
        const c = s[k]
        if (c === '…') { refuse(`a fill with nothing before it: ${pattern}`) }
        if (s[k + 1] === '…') {
            items.push({ c, n: undefined })
            k += 2
            if (s[k] === c) { k++ }
        } else {
            items.push({ c, n: 1 })
            k++
        }
    }
    const fixed = c => c === '0' || c === '1'
    const unknown = items.filter(x => fixed(x.c) && x.n === undefined)
    for (const c of new Set(items.filter(x => !fixed(x.c)).map(x => x.c))) {
        const own = items.filter(x => x.c === c)
        const fills = own.filter(x => x.n === undefined)
        if (fills.length > 1) { refuse(`two fills of the field ${c}: ${pattern}`) }
        const written = own.reduce((a, x) => a + (x.n ?? 0), 0)
        const w = widths[c]
        if (w === undefined) {
            unknown.push(...fills)
        } else if (fills.length === 1) {
            fills[0].n = w - written
            if (fills[0].n < 1) { refuse(`the field ${c} is ${w} bits wide, and ${written} are written beside its fill: ${pattern}`) }
        } else if (written !== w) {
            refuse(`the field ${c} is ${w} bits wide, and ${written} are written: ${pattern}`)
        }
    }
    if (unknown.length > 1) { refuse(`more than one fill to count: ${pattern}`) }
    const known = items.reduce((a, x) => a + (x.n ?? 0), 0)
    if (unknown.length === 1) {
        unknown[0].n = total - known
        if (unknown[0].n < 1) { refuse(`${known} bits beside the fill, and ${total} in all: ${pattern}`) }
    } else if (known !== total) {
        refuse(`${known} bits, not ${total}: ${pattern}`)
    }
    return items.map(x => x.c.repeat(x.n)).join('')
}

const group4 = chars => chars.match(/.{1,4}/g).join('_')

const analyse = chars => {
    let mask = 0n
    let value = 0n
    const positions = {}
    for (const [k, c] of [...chars].entries()) {
        const bit = BigInt(chars.length - 1 - k)
        if (c === '0' || c === '1') {
            mask |= 1n << bit
            if (c === '1') { value |= 1n << bit }
        } else {
            (positions[c] ??= []).push(bit)
        }
    }
    return { mask, value, positions }
}
// a field's bits, from the most significant one; they need not be adjacent
const scatter = (positions, x) => positions.reduce(
    (acc, bit, k) => acc | (x >> BigInt(positions.length - 1 - k) & 1n) << bit, 0n)
const gather = (positions, b) => positions.reduce((acc, bit) => acc << 1n | b >> bit & 1n, 0n)

/**
 * A region is a pattern with a hole, the letter x. `fill(region)` takes a
 * pattern as wide as the hole and answers the full pattern, so whoever
 * fills a region cannot write a bit outside it.
 */
export const fill = region => (inner, fields = {}) => {
    const outer = [...expand(region, 64)]
    if (outer.some(c => !'01x'.includes(c))) { refuse(`a region has fixed bits and a hole: ${region}`) }
    const hole = outer.filter(c => c === 'x').length
    const widths = Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, widthOf(t)]))
    const part = [...expand(inner, hole, widths)]
    const full = group4(outer.map(c => c === 'x' ? part.shift() : c).join(''))
    return Object.keys(fields).length === 0 ? full : [full, fields]
}

// ── Sums with declared bits ──────────────────────────────────────────────

const ALL = ones(64)
const EXP = 0x7FF0_0000_0000_0000n
const FRACTION = 0x000F_FFFF_FFFF_FFFFn
export const NAN = 0x7FF8_0000_0000_0000n
const INFINITY = 0x7FF0_0000_0000_0000n
const NEG_INFINITY = 0xFFF0_0000_0000_0000n
/** The bits of `f64c`: every float that is not a NaN, and the one NaN. */
const isF64c = b => (b & EXP) !== EXP || (b & FRACTION) === 0n || b === NAN
/** Every value of the pattern is a NaN other than `nan`. */
export const outside = (leaf, nan = NAN) => (leaf.mask & EXP) === EXP && (leaf.value & EXP) === EXP &&
    (leaf.value & FRACTION) !== 0n && (leaf.mask & (leaf.value ^ nan)) !== 0n
export const disjoint = (a, b) => (a.mask & b.mask & (a.value ^ b.value)) !== 0n

const leavesUnder = n => n.leaf ? [n.leaf] : [...n.children.values()].flatMap(leavesUnder)
const walk = (n, path) => path.split('.').reduce(
    (at, name) => at.children?.get(name) ?? refuse(`no variant ${path}`), n)
const pathsOf = t => {
    if (t.paths) { return t.paths }
    t.paths = new Map()
    const go = (n, names) => n.leaf ? t.paths.set(n.leaf, names)
        : n.children.forEach((child, name) => go(child, [...names, name]))
    go(t.nameRoot, [])
    return t.paths
}
/** The pattern of the variant at `path`, such as `string.tag100`. */
export const patternAt = (t, path) => {
    const leaf = walk(t.nameRoot, path).leaf
    return leaf?.payload === 'fields' ? group4(leaf.chars) : refuse(`${path} has no pattern`)
}
// Two layouts over one carrier. A pattern `l` lies inside a pattern `f`
// when every value of `l` is a value of `f`, and a value of `l` can be
// read through the fields of `f`.

/** Every value of the pattern `l` is a value of the pattern `f`. */
const within = (l, f) => (f.mask & ~l.mask) === 0n && (l.value & f.mask) === f.value
const sameBits = (a, b) => a.positions.join() === b.positions.join()
const isRef = m => kindOf(m.type) === 'reference'
/** An object type without fields: an object that the declaring module cannot see into. */
const opaque = o => Object.keys(resolve(o).fields).length === 0
/** A hole: an unsigned integer that is as wide as its bits, so any bits are a value of it. */
const takesAnyBits = g => {
    const t = resolve(g.type)
    return kindOf(t) === 'int' && t.lo === 0n && t.hi === ones(g.width)
}
/**
 * Why a value of the pattern `l` cannot be read through the fields of the
 * wider pattern `f`, or undefined when it can. The two have their
 * references in the same bits and in the same mode, so both count the same
 * values. A hole of `f` takes any bits. Any other field of `f` is a field
 * of `l` too.
 */
const misfit = (l, f) => {
    const mine = Object.values(l.fields)
    for (const [name, g] of Object.entries(f.fields)) {
        const m = mine.find(x => sameBits(x, g))
        if (isRef(g)) {
            const want = resolve(g.type)
            if (m === undefined || !isRef(m) || resolve(m.type).mode !== want.mode) {
                return `has no ${want.mode} where the other has one`
            }
            if (!opaque(want.o) && resolve(resolve(m.type).o) !== resolve(want.o)) {
                return `refers to another type of object in the field ${name}`
            }
        } else if (!takesAnyBits(g) && (m === undefined || resolve(m.type) !== resolve(g.type))) {
            return `has another field where the other has ${name}`
        }
    }
    const hidden = mine.find(m => isRef(m) && !Object.values(f.fields).some(g => isRef(g) && sameBits(g, m)))
    return hidden ? `holds a ${resolve(hidden.type).mode} where the other has none` : undefined
}
/**
 * `t` refines `frame`: each of its patterns lies inside a pattern of the
 * frame, under the same top variant. So a test that is derived from the
 * frame alone holds for `t`, and so does the frame's count of references.
 */
export const refines = (t, frame) => {
    for (const l of t.leaves) {
        const name = pathOf(t, l)
        const home = frame.leaves.find(f => l.payload === 'f64c' ? f.payload === 'f64c'
            : f.payload === 'fields' && within(l, f))
        if (!home) { refuse(`${name} is in no slot of the frame: ${l.payload === 'f64c' ? 'f64c' : group4(l.chars)}`) }
        const slot = pathOf(frame, home)
        if (slot.split('.')[0] !== name.split('.')[0]) { refuse(`${name} is in the slot ${slot}`) }
        const why = l.payload === 'fields' ? misfit(l, home) : undefined
        if (why) { refuse(`${name} ${why.replace('the other', `the frame's ${slot}`)}`) }
    }
    return t
}
/** The names of the variants of a sum, for host functions that make an arm for each. */
export const variants = t => [...t.nameRoot.children.keys()]
/** The name of a variant inside the type `t`, such as `string.short.s3x16`. */
export const pathOf = (t, leaf) => pathsOf(t).get(leaf).join('.')

/** A sum type is a set of leaves, and a node of the tree that names them. */
const sumType = (nameRoot, leaves, width) => {
    const t = type('sum', { layout: 'bits', width, nameRoot, leaves })
    Object.defineProperty(t, 'only', {
        value: (...paths) => {
            const nodes = paths.map(p => walk(nameRoot, p))
            return nodes.length === 1 ? nodeType(nodes[0], width)
                : sumType(nameRoot, [...new Set(nodes.flatMap(leavesUnder))], width)
        },
    })
    return t
}
const nodeType = (n, width) => {
    if (n.type) { return n.type }
    const t = n.type = sumType(n, leavesUnder(n), width)
    // the constructors: a group is its own type, with its variants inside
    n.children?.forEach((child, name) => {
        const leaf = child.leaf
        const variant = nodeType(child, width)
        t[name] = !leaf ? variant
            : leaf.payload === 'f64c' ? x => make(leaf, variant, x)
            : Object.keys(leaf.fields).length === 0 ? make(leaf, variant, {})
            : fields => make(leaf, variant, fields)
    })
    return t
}

/**
 * `bits(width, tree)`: a sum whose variants are bit patterns over one
 * carrier. An entry of the tree is a pattern, a pattern with its fields,
 * `f64c` for a float's own bits, a nested object for a group, or a `bits`
 * type of the same width that another module declared, which is a group too.
 */
export const bits = (width, tree) => {
    const build = (entry, label) => {
        if (entry === f64c) {
            if (width !== 64) { refuse('a float takes 64 bits') }
            return { leaf: { label, payload: 'f64c', fields: {} } }
        }
        if (typeof entry === 'string' || Array.isArray(entry)) {
            const [pattern, fields] = typeof entry === 'string' ? [entry, {}] : entry
            const widths = Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, widthOf(t)]))
            const chars = expand(pattern, width, widths)
            const { mask, value, positions } = analyse(chars)
            for (const c of Object.keys(positions)) {
                if (!(c in fields)) { refuse(`${label}: the field ${c} has no type`) }
            }
            for (const c of Object.keys(fields)) {
                if (!(c in positions)) { refuse(`${label}: the field ${c} is not in the pattern`) }
            }
            const info = Object.fromEntries(Object.entries(fields).map(
                ([k, t]) => [k, { type: t, positions: positions[k], width: positions[k].length }]))
            return { leaf: { label, payload: 'fields', chars, mask, value, fields: info } }
        }
        if (entry?.[TYPE] === 'sum') {
            if (entry.layout !== 'bits' || entry.width !== width) { refuse(`${label}: not a bits(${width}) type`) }
            return entry.nameRoot
        }
        if (entry?.[TYPE] !== undefined) { refuse(`${label}: a ${entry[TYPE]} cannot be a variant`) }
        return { children: new Map(Object.entries(entry).map(([name, e]) => [name, build(e, name)])) }
    }
    const root = build(tree, 'the sum')
    const t = nodeType(root, width)
    // the proofs of a layout
    const patterns = t.leaves.filter(l => l.payload === 'fields')
    if (t.leaves.some(l => l.payload === 'f64c')) {
        for (const l of patterns) {
            if (!outside(l)) { refuse(`${pathOf(t, l)} holds the bits of a number: ${group4(l.chars)}`) }
        }
    }
    for (const [k, a] of patterns.entries()) {
        for (const b of patterns.slice(k + 1)) {
            if (!disjoint(a, b)) {
                refuse(`${pathOf(t, a)} and ${pathOf(t, b)} overlap: ${group4(a.chars)} and ${group4(b.chars)}`)
            }
        }
    }
    return t
}

const matches = (leaf, b) => leaf.payload === 'f64c' ? isF64c(b) : (b & leaf.mask) === leaf.value
/** The variant of the bits `b`, or undefined for junk. */
export const leafOf = (t, b) => t.leaves.find(l => matches(l, b))
export const leaves = t => t.leaves
export const patternOf = leaf => group4(leaf.chars)

/** The fields that every variant of `t` has. A `ref` and a `stat` read as a `view`. */
const shared = t => {
    const [first, ...rest] = t.leaves
    const out = {}
    for (const [name, f] of Object.entries(first?.fields ?? {})) {
        const types = [f.type, ...rest.map(l => l.fields[name]?.type)].map(x => x && resolve(x))
        if (types.includes(undefined)) { continue }
        const t0 = types[0]
        if (types.every(x => x === t0)) {
            out[name] = t0
        } else if (types.every(x => kindOf(x) === 'reference' && resolve(x.o) === resolve(t0.o))) {
            out[name] = view(t0.o)
        }
    }
    return out
}

// ── Default sums ─────────────────────────────────────────────────────────

/** A sum without declared bits: a tag and a payload. */
export const sum = variants => {
    const t = type('sum', { layout: 'default', variants })
    for (const [name, payload] of Object.entries(variants)) {
        t[name] = kindOf(payload) === 'product' && Object.keys(resolve(payload)).length === 0
            ? node('tag', { tag: name }, t)
            : x => node('tag', { tag: name, payload: expr(x) }, t)
    }
    return t
}
const options = new Map()
export const option = T => options.get(T) ?? options.set(T, sum({ none: unit, some: T })).get(T)

// ── Expressions ──────────────────────────────────────────────────────────

let ids = 0
const lazy = (n, name, create) => Object.defineProperty(n, name, {
    enumerable: true,
    configurable: true,
    get: () => {
        const value = create()
        Object.defineProperty(n, name, { enumerable: true, value })
        return value
    },
})
const fieldType = (t, name) => {
    switch (kindOf(t)) {
        case 'reference': return resolve(resolve(t.o).fields[name])
        case 'sum': return shared(t)[name]
        case 'product': return resolve(t[name])
        case 'array': return range(BigInt(t.n), BigInt(t.n))
        case 'tail': return t.len
        default: return undefined
    }
}
// What a JavaScript property of an expression means comes from its type:
// the fields of an object, the fields that all variants share, `length`
// and `at`. A name that the type does not have is `undefined` in
// JavaScript, and `expr` refuses it.
const node = (op, props, t) => {
    const n = { [NODE]: { op, ...props }, [STATIC]: t }
    if (t === undefined) { return n }
    t = resolve(t)
    const k = kindOf(t)
    const names = k === 'reference' ? Object.keys(resolve(t.o).fields)
        : k === 'sum' && t.layout === 'bits' ? Object.keys(shared(t))
        : k === 'product' ? Object.keys(t)
        : k === 'array' || k === 'tail' ? ['length']
        : []
    for (const name of names) {
        lazy(n, name, () => node('field', { of: n, name }, fieldType(t, name)))
    }
    if (k === 'array' || k === 'tail') {
        Object.defineProperty(n, 'at', { value: index => node('at', { of: n, index: expr(index) }, resolve(t.item)) })
    }
    return n
}
const expr = e => {
    const k = typeof e
    if (k === 'bigint' || k === 'number' || k === 'boolean') { return e }
    if (k === 'object' && e !== null && e[TYPE] === undefined) { return e }
    return refuse(`not an expression: ${k === 'object' ? 'a type' : String(e)}`)
}
/** The type of an expression, as far as its operands give it. A range is an upper bound. */
const typeOf = e => {
    switch (typeof e) {
        case 'bigint': return range(e, e)
        case 'number': return f64c
        case 'boolean': return bool
        default: return e[STATIC]
    }
}
const isFloat = t => kindOf(t) === 'f64' || kindOf(t) === 'f64c'
// Subtyping is the subset relation: each pattern of `a` lies inside one of `b`.
const inside = (l, f) => l === f || (l.payload === 'f64c' ? f.payload === 'f64c'
    : f.payload === 'fields' && within(l, f) && misfit(l, f) === undefined)
const subset = (a, b) => a.leaves.every(l => b.leaves.some(f => inside(l, f)))
/** Whether every value of the `bits` type `a` is a value of `b`, and can be read as one. */
export const subtype = (a, b) => subset(resolve(a), resolve(b))
const join = (a, b) => {
    if (a === undefined || b === undefined) { return undefined }
    a = resolve(a)
    b = resolve(b)
    if (a === never) { return b }
    if (b === never || a === b) { return a }
    const ka = kindOf(a)
    const kb = kindOf(b)
    if (ka === 'named' || kb === 'named') {
        refuse(`two branches of different types: ${ka === 'named' ? a.name : `a ${ka}`} and ${kb === 'named' ? b.name : `a ${kb}`}`)
    }
    if (ka === 'int' && kb === 'int') { return range(a.lo < b.lo ? a.lo : b.lo, a.hi > b.hi ? a.hi : b.hi) }
    if (isFloat(a) && isFloat(b)) { return f64 }
    if (ka === 'sum' && kb === 'sum' && a.layout === 'bits' && b.layout === 'bits') {
        return subset(a, b) ? b : subset(b, a) ? a
            : sumType(a.nameRoot === b.nameRoot ? a.nameRoot : undefined, [...new Set([...a.leaves, ...b.leaves])], a.width)
    }
    return undefined
}
/** Refuses what a type alone can show to be wrong. Ranges are left to the evaluator. */
const accept = (want, e, what) => {
    if (Array.isArray(e)) {
        // an array of the host with n expressions is an array(T, n) value
        const w = want && resolve(unOwn(want))
        if (kindOf(w) !== 'array') { refuse(`${what}: an array where a ${kindOf(w)} is needed`) }
        if (e.length !== w.n) { refuse(`${what}: ${e.length} items where ${w.n} are needed`) }
        e.forEach((x, k) => accept(w.item, expr(x), `${what}, item ${k}`))
        return e
    }
    const have = typeOf(e)
    if (have === undefined || want === undefined) { return e }
    const w = resolve(unOwn(want))
    const h = resolve(have)
    const kw = kindOf(w)
    const kh = kindOf(h)
    if (h === never) { return e }
    if (kw === 'named' || kh === 'named') {
        if (kw === 'named' && typeof e === 'bigint') { return accept(w.base, e, what) }
        if (w !== h) {
            refuse(`${what}: ${kh === 'named' ? h.name : `a ${kh}`} where ${kw === 'named' ? w.name : `a ${kw}`} is needed. Write as(T, x)`)
        }
        return e
    }
    if (kw === 'f64c' && kh === 'f64') { refuse(`${what}: an f64 where an f64c is needed. Write canon(x)`) }
    if (kw === 'sum' && w.layout === 'bits') {
        if (kh !== 'sum' || h.layout !== 'bits' || !subset(h, w)) { refuse(`${what}: a value that can be outside the type`) }
    } else if (kw === 'reference') {
        const lend = { view: ['view', 'ref', 'uniq', 'stat'], ref: ['ref'], uniq: ['uniq'], stat: ['stat'] }
        if (kh !== 'reference' || resolve(h.o) !== resolve(w.o) || !lend[w.mode].includes(h.mode)) {
            refuse(`${what}: not a ${w.mode} of ${resolve(w.o).name}`)
        }
    } else if (kw !== kh && !(isFloat(w) && isFloat(h))) {
        refuse(`${what}: a ${kh} where a ${kw} is needed`)
    }
    return e
}

const binder = (name, t) => node('binder', { name, id: ids++ }, t)
const arith = (op, rule) => (a, b) => {
    const ta = typeOf(expr(a))
    const tb = typeOf(expr(b))
    const t = kindOf(ta) === 'int' && kindOf(tb) === 'int' ? rule(resolve(ta), resolve(tb))
        : isFloat(ta) && isFloat(tb) ? f64
        : refuse(`${op}: two integers or two floats`)
    return node(op, { a, b }, t)
}
const least = xs => xs.reduce((a, b) => a < b ? a : b)
const most = xs => xs.reduce((a, b) => a > b ? a : b)
export const add = arith('add', (a, b) => range(a.lo + b.lo, a.hi + b.hi))
export const sub = arith('sub', (a, b) => range(a.lo - b.hi, a.hi - b.lo))
export const mul = arith('mul', (a, b) => {
    const p = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi]
    return range(least(p), most(p))
})
const compare = op => (a, b) => node(op, { a: expr(a), b: expr(b) }, bool)
export const lt = compare('lt')
export const le = compare('le')
export const eq = compare('eq')
export const if_ = (c, a, b) => {
    accept(bool, expr(c), 'the condition of if_')
    return node('if', { c, a: expr(a), b: expr(b) }, join(typeOf(a), typeOf(b)))
}
export const trap = reason => node('trap', { reason }, never)
export const let_ = (bindings, body) => {
    const names = Object.keys(bindings)
    const binders = names.map(name => binder(name, typeOf(expr(bindings[name]))))
    const b = expr(body(Object.fromEntries(names.map((name, k) => [name, binders[k]]))))
    return node('let', { values: names.map(name => bindings[name]), binders, body: b }, typeOf(b))
}
/** Replaces any NaN by the canonical one. */
export const canon = x => {
    if (!isFloat(typeOf(expr(x)))) { refuse('canon takes a float') }
    return node('canon', { x }, f64c)
}
/** Whether two values have the same representation: one carrier, or one object. */
export const identical = (a, b) => node('identical', { a: expr(a), b: expr(b) }, bool)
/** A module constant of a copy type, which is data. */
export const constant = (t, value) => {
    conform(t, value, 'a constant')
    return node('constant', { value }, t)
}
/** The one conversion between a named type and its definition, in either direction. */
export const as = (T, e) => {
    const to = resolve(T)
    const have = typeOf(expr(e)) && resolve(typeOf(e))
    if (kindOf(to) === 'named') {
        accept(to.base, e, `as ${to.name}`)
    } else if (kindOf(have) === 'named') {
        if (kindOf(have.base) !== kindOf(to)) { refuse(`as: ${have.name} is not a ${kindOf(to)}`) }
    } else {
        refuse('as converts between a named type and its definition')
    }
    return node('as', { e, to }, to)
}
// stands for a range that the checker's flow refinement would find
const refined = (t, e) => node('refined', { e, t }, t)
export const narrow = (T, e) => let_({ x: e }, ({ x }) =>
    if_(lt(x, T.lo), trap('out of range'), if_(lt(T.hi, x), trap('out of range'), refined(T, x))))
export const try_narrow = (T, e) => let_({ x: e }, ({ x }) =>
    if_(lt(x, T.lo), option(T).none, if_(lt(T.hi, x), option(T).none, option(T).some(refined(T, x)))))

const make = (leaf, variant, x) => {
    if (leaf.payload === 'f64c') { return node('make', { leaf, x: accept(f64c, expr(x), 'a number') }, variant) }
    for (const name of Object.keys(x)) {
        if (!(name in leaf.fields)) { refuse(`${leaf.label} has no field ${name}`) }
    }
    for (const [name, f] of Object.entries(leaf.fields)) {
        if (!(name in x)) { refuse(`${leaf.label} needs its field ${name}`) }
        accept(f.type, expr(x[name]), `the field ${name} of ${leaf.label}`)
    }
    return node('make', { leaf, x }, variant)
}

// ── match ────────────────────────────────────────────────────────────────

/**
 * `match_(v, arms)`: an arm per variant or per group, in any mix. A nested
 * object holds the arms of a group, and `else` takes what is left. Over an
 * integer the arms are its values, and over a default sum its tags.
 */
export const match_ = (v, arms) => {
    const t = typeOf(expr(v)) && resolve(typeOf(v))
    const k = kindOf(t)
    const types = []
    const arm = (f, b) => {
        if (typeof f !== 'function') { refuse('an arm is a function') }
        const body = expr(f(b))
        types.push(typeOf(body))
        return { binder: b, body }
    }
    const done = normal => node('match', { of: v, t, arms: normal }, types.reduce(join))
    if (k === 'int') {
        const normal = { values: new Map() }
        for (const [key, f] of Object.entries(arms)) {
            if (key === 'else') { normal.else = arm(f, binder('rest', t)) } else { normal.values.set(BigInt(key), arm(f)) }
        }
        if (!normal.else) {
            for (let x = t.lo; x <= t.hi; x++) {
                if (!normal.values.has(x)) { refuse(`match: no arm for ${x}, and no else`) }
            }
        }
        return done(normal)
    }
    if (k === 'sum' && t.layout === 'default') {
        const normal = {}
        for (const [name, f] of Object.entries(arms)) {
            if (name !== 'else' && !(name in t.variants)) { refuse(`match: no variant ${name}`) }
            normal[name] = arm(f, binder(name, name === 'else' ? t : resolve(t.variants[name])))
        }
        for (const name of Object.keys(t.variants)) {
            if (!(name in normal) && !normal.else) { refuse(`match: no arm for ${name}`) }
        }
        return done(normal)
    }
    if (k !== 'sum') { refuse('match takes a sum or an integer') }
    if (!t.nameRoot) { refuse('match: bind the operand to a type first') }
    const covered = new Set()
    const build = (n, arms, where) => {
        const normal = {}
        for (const [name, f] of Object.entries(arms)) {
            if (name === 'else') { continue }
            const child = n.children?.get(name) ?? refuse(`match: no variant ${where}${name}`)
            const mine = leavesUnder(child).filter(l => t.leaves.includes(l))
            if (mine.length === 0) { refuse(`match: the operand is never ${where}${name}`) }
            if (typeof f === 'function') {
                mine.forEach(l => covered.add(l))
                const whole = mine.length === leavesUnder(child).length
                normal[name] = child.leaf?.payload === 'f64c' ? { ...arm(f, binder(name, f64c)), float: true }
                    : arm(f, binder(name, whole ? nodeType(child, t.width) : sumType(child, mine, t.width)))
            } else if (child.children) {
                normal[name] = { nested: build(child, f, `${where}${name}.`) }
            } else {
                refuse(`match: ${where}${name} is not a group`)
            }
        }
        const rest = leavesUnder(n).filter(l => t.leaves.includes(l) && !covered.has(l))
        if ('else' in arms) {
            if (rest.length === 0) { refuse(`match: the else of ${where || 'the match'} takes nothing`) }
            rest.forEach(l => covered.add(l))
            normal.else = arm(arms.else, binder('rest', sumType(n, rest, t.width)))
        } else if (rest.length !== 0) {
            refuse(`match: no arm for ${rest.map(l => pathOf(t, l)).join(', ')}`)
        }
        return normal
    }
    return done(build(t.nameRoot, arms, ''))
}

// ── Loops, functions and the heap ────────────────────────────────────────

class Next {
    constructor(id, values) {
        this.id = id
        this.values = values
    }
}
export const loop_ = (params, body) => {
    const names = Object.keys(params)
    const decl = names.map(name => params[name]?.[TYPE] === 'loop parameter' ? params[name]
        : refuse(`the loop parameter ${name} is written T.of(start)`))
    const binders = names.map((name, k) => binder(name, decl[k].type))
    const id = ids++
    const next = values => {
        if (Object.keys(values).join() !== names.join()) { refuse(`next takes ${names.join(', ')}`) }
        return node('next', { id, values: names.map((name, k) => accept(decl[k].type, expr(values[name]), name)) }, never)
    }
    const b = expr(body(Object.fromEntries(names.map((name, k) => [name, binders[k]])), next))
    return node('loop', {
        id, names, binders, body: b,
        types: decl.map(d => d.type),
        starts: decl.map((d, k) => accept(d.type, expr(d.start), names[k])),
    }, typeOf(b))
}

/** `fn(params, result, body)`. Calling the function with expressions is a call. */
export const fn = (params, result, body) => {
    const names = Object.keys(params)
    const types = names.map(name => unOwn(params[name]))
    const binders = names.map((name, k) => binder(name, types[k]))
    let built
    const f = (...args) => {
        if (args.length !== names.length) { refuse(`a call takes ${names.join(', ')}`) }
        return node('call', { f, args: args.map((a, k) => accept(types[k], expr(a), names[k])) }, result)
    }
    f.info = {
        names, types, result, binders,
        // built on first use, so that a function can call itself
        get body() {
            return built ??= accept(result, expr(body(Object.fromEntries(names.map((name, k) => [name, binders[k]])))), 'the result')
        },
    }
    return f
}

export const alloc = (O, fields, capacity) => node('alloc', { O, fields: expr(fields), capacity: expr(capacity) }, uniq(O))
const uniqOf = (d, what) => {
    const t = typeOf(expr(d)) && resolve(typeOf(d))
    return kindOf(t) === 'reference' && t.mode === 'uniq' ? t : refuse(`${what} takes a uniq`)
}
export const push = (d, item) => node('push', { d, item: expr(item) }, uniqOf(d, 'push'))
export const freeze = d => node('freeze', { d }, ref(uniqOf(d, 'freeze').o))

// ── The evaluator ────────────────────────────────────────────────────────

const conforms = (t, v) => {
    t = resolve(unOwn(t))
    switch (kindOf(t)) {
        case 'int': return typeof v === 'bigint' && t.lo <= v && v <= t.hi
        // the evaluator's floats are JavaScript numbers, which have one NaN
        case 'f64': case 'f64c': return typeof v === 'number'
        case 'bool': return typeof v === 'boolean'
        case 'named': return conforms(t.base, v)
        case 'array': return Array.isArray(v) && v.length === t.n && v.every(x => conforms(t.item, x))
        case 'product': return typeof v === 'object' && v !== null && Object.keys(t).every(k => conforms(t[k], v[k]))
        case 'sum': return t.layout === 'bits' ? v?.[VALUE] === 'bits' && leafOf(t, v.bits) !== undefined
            : v?.[VALUE] === 'sum' && v.tag in t.variants &&
                (v.payload === undefined || conforms(t.variants[v.tag], v.payload))
        case 'reference': return v?.[VALUE] === 'reference' && v.obj.o === resolve(t.o) &&
            (t.mode === 'view' || t.mode === v.mode)
        default: return true
    }
}
const conform = (t, v, what) => conforms(t, v) ? v : refuse(`${what} is outside its type`)

const floatBits = x => Number.isNaN(x) ? NAN : new BigUint64Array(new Float64Array([x]).buffer)[0]
const bitsFloat = b => new Float64Array(new BigUint64Array([b]).buffer)[0]
const lookup = (env, id) => {
    for (let e = env; e; e = e.next) {
        if (e.id === id) { return e.value }
    }
    throw new Error('an unbound local')
}
const bind = (env, binders, values) => binders.reduce(
    (e, b, k) => b ? { id: b[NODE].id, value: values[k], next: e } : e, env)
const index = (length, i) => 0n <= i && i < length ? Number(i) : (() => { throw new Trap('not an index') })()

const ev = (e, env) => {
    if (typeof e !== 'object') { return e }
    if (Array.isArray(e)) { return e.map(x => ev(x, env)) }
    const n = e[NODE]
    if (n === undefined) { return Object.fromEntries(Object.entries(e).map(([k, x]) => [k, ev(x, env)])) }
    switch (n.op) {
        case 'binder': return lookup(env, n.id)
        case 'constant': return n.value
        case 'add': { const a = ev(n.a, env); return a + ev(n.b, env) }
        case 'sub': { const a = ev(n.a, env); return a - ev(n.b, env) }
        case 'mul': { const a = ev(n.a, env); return a * ev(n.b, env) }
        case 'lt': { const a = ev(n.a, env); return a < ev(n.b, env) }
        case 'le': { const a = ev(n.a, env); return a <= ev(n.b, env) }
        case 'eq': { const a = ev(n.a, env); return a === ev(n.b, env) }
        case 'if': return ev(n.c, env) ? ev(n.a, env) : ev(n.b, env)
        case 'trap': throw new Trap(n.reason)
        case 'let': return ev(n.body, bind(env, n.binders, n.values.map(x => ev(x, env))))
        case 'canon': return ev(n.x, env)
        case 'as': return conform(n.to, ev(n.e, env), 'a converted value')
        case 'refined': return conform(n.t, ev(n.e, env), 'a refined value')
        case 'identical': {
            const a = ev(n.a, env)
            const b = ev(n.b, env)
            return a[VALUE] === 'bits' ? a.bits === b.bits : a.obj === b.obj
        }
        case 'tag': return sumValue(n.tag, n.payload === undefined ? undefined : ev(n.payload, env))
        case 'make': {
            const { leaf } = n
            if (leaf.payload === 'f64c') { return bitsValue(floatBits(ev(n.x, env))) }
            let b = leaf.value
            for (const [name, f] of Object.entries(leaf.fields)) {
                const v = conform(f.type, ev(n.x[name], env), `the field ${name} of ${leaf.label}`)
                b |= scatter(f.positions, enc(f.type, v, f.width))
            }
            return bitsValue(b)
        }
        case 'field': {
            const of = ev(n.of, env)
            const t = resolve(typeOf(n.of))
            switch (kindOf(t)) {
                case 'reference': {
                    const ft = resolve(resolve(t.o).fields[n.name])
                    if (kindOf(ft) === 'tail') { return tailValue(of.obj) }
                    // a counted field read through a reference is borrowed
                    return of.obj.fields[n.name]
                }
                case 'tail': return BigInt(of.obj.items.length)
                case 'array': return BigInt(of.length)
                case 'product': return of[n.name]
                case 'sum': {
                    const leaf = leafOf(t, of.bits) ?? (() => { throw new Error('stuck: junk') })()
                    const f = leaf.fields[n.name]
                    const v = dec(f.type, gather(f.positions, of.bits), f.width)
                    return v[VALUE] === 'reference' ? refValue(resolve(typeOf(e)).mode, v.obj) : v
                }
                default: throw new Error('stuck: a field of nothing')
            }
        }
        case 'at': {
            const of = ev(n.of, env)
            const i = ev(n.index, env)
            return Array.isArray(of) ? of[index(BigInt(of.length), i)] : of.obj.items[index(BigInt(of.obj.items.length), i)]
        }
        case 'match': {
            const v = ev(n.of, env)
            const take = a => ev(a.body, bind(env, [a.binder], [a.float ? bitsFloat(v.bits) : v]))
            if (typeof v === 'bigint') {
                const a = n.arms.values.get(v) ?? n.arms.else
                return a ? take(a) : (() => { throw new Error('stuck: no arm') })()
            }
            if (v[VALUE] === 'sum') {
                const a = n.arms[v.tag]
                return a ? ev(a.body, bind(env, [a.binder], [v.payload])) : take(n.arms.else)
            }
            const leaf = leafOf(n.t, v.bits) ?? (() => { throw new Error('stuck: junk') })()
            let arms = n.arms
            for (const name of pathsOf(n.t).get(leaf)) {
                const a = arms[name]
                if (a === undefined) { break }
                if (!a.nested) { return take(a) }
                arms = a.nested
            }
            return take(arms.else)
        }
        case 'loop': {
            let values = n.starts.map(x => ev(x, env))
            for (;;) {
                values.forEach((v, k) => conform(n.types[k], v, `the loop parameter ${n.names[k]}`))
                const r = ev(n.body, bind(env, n.binders, values))
                if (!(r instanceof Next && r.id === n.id)) { return r }
                values = r.values
            }
        }
        case 'next': return new Next(n.id, n.values.map(x => ev(x, env)))
        case 'call': return call(n.f, n.args.map(x => ev(x, env)))
        case 'alloc': {
            const O = resolve(n.O)
            const fields = ev(n.fields, env)
            for (const [name, t] of Object.entries(O.fields)) {
                if (kindOf(t) !== 'tail') { conform(t, fields[name], `the field ${name} of ${O.name}`) }
            }
            return refValue('uniq', newObject(O, fields, ev(n.capacity, env)))
        }
        case 'push': {
            const d = ev(n.d, env)
            const item = ev(n.item, env)
            if (d.obj.frozen) { throw new Error('stuck: a push into a frozen object') }
            if (BigInt(d.obj.items.length) >= d.obj.capacity) { throw new Trap('no room') }
            const t = Object.values(d.obj.o.fields).map(resolve).find(x => kindOf(x) === 'tail')
            d.obj.items.push(conform(t.item, item, 'a pushed item'))
            return d
        }
        case 'freeze': {
            const d = ev(n.d, env)
            d.obj.frozen = true
            return refValue('ref', d.obj)
        }
        default: throw new Error(`no rule for ${n.op}`)
    }
}
const call = (f, args) => {
    const { names, types, result, binders, body } = f.info
    args.forEach((v, k) => conform(types[k], v, `the argument ${names[k]}`))
    return conform(result, ev(body, bind(null, binders, args)), 'a result')
}
/** Runs a function on values of the host. */
export const run = (f, ...args) => call(f, args)
/** The value of an expression with no free locals, such as a module constant. */
export const evaluate = e => ev(expr(e), null)
/** A static object, as the compiler would put one into a data segment. */
export const staticObject = (O, fields, items) => {
    const obj = newObject(O, fields, BigInt(items.length))
    obj.items.push(...items)
    obj.frozen = true
    return refValue('stat', obj)
}
export const itemsOf = r => r.obj.items

// ── What a layout derives ────────────────────────────────────────────────

/**
 * One mask test that is true for the variants `wanted` of `t` and false for
 * its other variants, with every bit dropped that the test does not need.
 * A bit pattern that no variant uses is junk, so a test may accept it.
 */
export const singleTest = (t, wanted) => {
    const others = t.leaves.filter(l => !wanted.includes(l))
    if (wanted.some(l => l.payload === 'f64c')) { return undefined }
    let mask = wanted.reduce((m, l) => m & l.mask, ALL)
    for (const l of wanted) { mask &= ~(l.value ^ wanted[0].value) }
    let value = wanted[0].value & mask
    const ok = (mask, value) => others.every(l => l.payload === 'f64c' ? outside({ mask, value }) : disjoint({ mask, value }, l))
    if (!ok(mask, value)) { return undefined }
    // from the top bit down, so that the tags in the low bits are what stays
    for (let bit = BigInt(t.width) - 1n; bit >= 0n; bit--) {
        const m = mask & ~(1n << bit)
        if (m !== mask && ok(m, value & m)) {
            mask = m
            value &= m
        }
    }
    return { mask, value }
}

/**
 * The test for the float variant of `t`. A float whose exponent is not all
 * ones is a number. Of the rest, one mask test is true for the infinities
 * and each NaN of `f64c`, and false for every pattern.
 */
export const numberTest = (t, nans = [NAN]) => {
    const points = [INFINITY, NEG_INFINITY, ...nans]
    const others = t.leaves.filter(l => l.payload !== 'f64c')
    let mask = ALL
    for (const p of points) { mask &= ~(p ^ points[0]) }
    let value = points[0] & mask
    const ok = (mask, value) => others.every(l => disjoint({ mask, value }, l))
    if (!ok(mask, value)) { return undefined }
    for (let bit = BigInt(t.width) - 1n; bit >= 0n; bit--) {
        const m = mask & ~(1n << bit)
        if (m !== mask && ok(m, value & m)) {
            mask = m
            value &= m
        }
    }
    return { exponent: EXP, mask, value }
}

/**
 * A decision tree of one-bit tests that finds the class of a value of `t`.
 * `classOf` gives each variant its class: its kind, say. A float is found
 * first, by its exponent.
 */
export const decisionTree = (t, classOf, nans = [NAN]) => {
    const number = t.leaves.find(l => l.payload === 'f64c')
    const cands = t.leaves.filter(l => l !== number).map(l => ({ mask: l.mask, value: l.value, cls: classOf(l) }))
    if (number) {
        // the numbers whose exponent is all ones: the infinities and each NaN of f64c
        for (const value of [INFINITY, NEG_INFINITY, ...nans]) { cands.push({ mask: ALL, value, cls: classOf(number) }) }
    }
    const count = xs => new Set(xs.map(c => c.cls)).size
    const build = cands => {
        if (count(cands) <= 1) { return { cls: cands[0].cls } }
        let best
        for (let bit = 0n; bit < 64n; bit++) {
            const m = 1n << bit
            const zero = cands.filter(c => c.mask & m && !(c.value & m))
            const one = cands.filter(c => c.mask & m && c.value & m)
            if (zero.length === 0 || one.length === 0) { continue }
            const free = cands.filter(c => !(c.mask & m))
            const b0 = [...zero, ...free]
            const b1 = [...one, ...free]
            const score = [free.length, Math.max(count(b0), count(b1)), Math.max(b0.length, b1.length)]
            if (!best || score.some((x, k) => x < best.score[k] && score.slice(0, k).every((y, j) => y === best.score[j]))) {
                best = { bit, b0, b1, score }
            }
        }
        return { bit: best.bit, zero: build(best.b0), one: build(best.b1) }
    }
    const tree = build(cands)
    // the proof: every value of every pattern reaches its class
    const prove = (n, c) => n.cls !== undefined ? n.cls === c.cls
        : c.mask >> n.bit & 1n ? prove(c.value >> n.bit & 1n ? n.one : n.zero, c)
        : prove(n.zero, c) && prove(n.one, c)
    if (!cands.every(c => prove(tree, c))) { throw new Error('the derived tree is wrong') }
    return number ? { number: classOf(number), nan: tree } : tree
}
export const classify = (tree, b) => {
    if (tree.nan) { return (b & EXP) !== EXP ? tree.number : classify(tree.nan, b) }
    while (tree.cls === undefined) { tree = b >> tree.bit & 1n ? tree.one : tree.zero }
    return tree.cls
}
export const depth = tree => tree.nan ? 1 + depth(tree.nan) : tree.cls !== undefined ? 0 : 1 + Math.max(depth(tree.zero), depth(tree.one))
export const showTree = (tree, pad = '') => {
    if (tree.nan) { return `${pad}exponent not all ones: ${tree.number}\n${pad}else\n${showTree(tree.nan, pad + '  ')}` }
    if (tree.cls !== undefined) { return `${pad}${tree.cls}\n` }
    const line = (label, n) => n.cls !== undefined ? `${pad}bit ${tree.bit} is ${label}: ${n.cls}\n`
        : `${pad}bit ${tree.bit} is ${label}\n${showTree(n, pad + '  ')}`
    return line(1, tree.one) + line(0, tree.zero)
}
