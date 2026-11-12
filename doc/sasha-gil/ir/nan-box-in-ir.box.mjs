// @ts-nocheck
// The NaN box of doc/sergey-shandar/nanvm/README.md, written in the planned
// IR of doc/sasha-gil/ir/type-system.md and split by the runtime modules of
// doc/sasha-gil/wasm/modular-l0.md. One file here, with a section a module.
// It accompanies nan-box-in-ir.md, which quotes it.
import {
    add, alloc, array, as, bits, bool, canon, code, constant, eq, f64, f64c, fill, fn, freeze, i, i64, identical,
    if_, int, le, let_, loop_, lt, match_, named, narrow, object, option, own, patternAt, push, ref, refines,
    stat, sub, tail, trap, try_narrow, u, u16, u64, uniq, variants, view,
    // not used here: the declarations that tsc emits for this file name them
    NODE, STATIC, TYPE,
} from './nan-box-in-ir.edsl.mjs'

// ── Any ──────────────────────────────────────────────────────────────────
// Any owns the 64 bits. Its frame is its own view of them: the kinds, and a
// slot wherever another module keeps its values. Any is written over the
// frame alone, so it does not depend on what a module puts into a slot.

// The README's type tags, and 0111 for an array, which it does not have.
const tag = { object: '0011', string: '0100', bigint: '0101', function: '0110', array: '0111' }
/**
 * README: `s111_1111_1111_tttt_....10`, a reference. `s` is static, `tttt`
 * is the type, and the rest is the pointer without its two alignment bits.
 * A kind's module gives the type of its objects.
 */
export const reference = (kind, O) => ({
    heap: [`0111_1111_1111_${tag[kind]}_p…p_10`, { p: ref(O) }],
    lit: [`1111_1111_1111_${tag[kind]}_p…p_10`, { p: stat(O) }],
})
// What an object of another module holds is not Any's to know.
const Storage = object('Storage', {})

const scalars = {
    number: f64c,
    boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],
    undefined: '0111_1111_1111_0…0_0010_0000',
    null: '0111_1111_1111_0…0_0011_0000',
}

// A slot is a variant whose one field is a hole, x.
export const frame = bits(64, {
    ...scalars,
    string: {
        // README: `s111_1111_1111_..._vv00`, the scalars. Any keeps the rows
        // that end in 0000. The rows that end in 100 and in 1000 are String's.
        tag100: ['x111_1111_1111_x…x_100', { x: u(50) }],
        tag1000: ['x111_1111_1111_x…x_1000', { x: u(49) }],
        long: reference('string', Storage),
    },
    bigint: {
        // README: `s111_1111_1111_..._vvv1`, the short bigint.
        short: ['x111_1111_1111_x…x_1', { x: u(52) }],
        long: reference('bigint', Storage),
    },
    array: reference('array', Storage),
    object: reference('object', Storage),
    function: reference('function', Storage),
})

/** A module fills the hole of a slot with a pattern of its own, so it cannot write a bit outside it. */
export const slot = path => fill(patternAt(frame, path))

/** The runtime's union: the frame with each slot refined by the group of its module. */
export const assemble = groups => refines(bits(64, { ...scalars, ...groups }), frame)

// L0's four constants.
export const undefined_ = frame.undefined
export const null_ = frame.null
export const true_ = frame.boolean({ b: true })
export const false_ = frame.boolean({ b: false })

/** L0 `kind`, with the tags of the ABI. */
export const kind = fn({ v: frame }, int(0n, 8n), ({ v }) =>
    match_(v, {
        undefined: () => 0n,
        null: () => 1n,
        boolean: () => 2n,
        number: () => 3n,
        string: () => 4n,
        bigint: () => 5n,
        array: () => 6n,
        object: () => 7n,
        function: () => 8n,
    }))

/** L0 `to_f64`. Misuse traps. */
export const to_f64 = fn({ v: frame }, f64c, ({ v }) =>
    match_(v, {
        number: x => x,
        else: () => trap('not a number'),
    }))

/** L0 `from_f64`. A float from outside can hold any NaN. */
export const from_f64 = fn({ x: f64 }, frame.only('number'), ({ x }) => frame.number(canon(x)))

/** L0 `to_bool`. Misuse traps. */
export const to_bool = fn({ v: frame }, bool, ({ v }) =>
    match_(v, {
        boolean: ({ b }) => b,
        else: () => trap('not a boolean'),
    }))

/** L0 `from_bool`. */
export const from_bool = fn({ b: bool }, frame.only('boolean'), ({ b }) => frame.boolean({ b }))

/** L0 `same`: two arrays, objects or functions are the same value. */
const container = frame.only('array', 'object', 'function')
export const same = fn({ a: container, b: container }, bool, ({ a, b }) => identical(a, b))

// ── String ───────────────────────────────────────────────────────────────

export const StrObj = object('StrObj', { units: tail(u16, u(31)) })
// A unit of six bits is a code of the alphabet below and not a code unit,
// so it has a name, and no code can use one for the other by mistake.
const Id6 = named('Id6', u(6))

// String's two slots. A hole is filled from its top bit, which is the sign.
const tag100 = slot('string.tag100')   // 50 bits
const tag1000 = slot('string.tag1000') // 49 bits
const nibble = n => n.toString(2).padStart(4, '0')
/** In the slot that ends in 1000, the next four bits are the length. */
const row = (w, n) => tag1000(`0_0…0_u…u_${nibble(n)}`, { u: array(u(w), n) })

export const string = bits(64, {
    empty: tag1000('0…0'),
    short: {
        s1x16: row(16, 1),
        s2x16: row(16, 2),
        s4x7: row(7, 4),
        s5x7: row(7, 5),
        s6x7: row(7, 6),
        s3x16: tag100('0_u…u_0', { u: array(u16, 3) }),
        s8x6: tag100('0_u…u_1', { u: array(Id6, 8) }),
        s7x7: tag100('1_u…u', { u: array(u(7), 7) }),
    },
    long: reference('string', StrObj),
})

/** A host function: the same arm for every variant of a group. */
const each = (group, arm) => Object.fromEntries(variants(group).map(name => [name, arm]))

/** L0 `length` of a string: the number of UTF-16 code units. */
export const length = fn({ s: string }, u(31), ({ s }) =>
    match_(s, {
        empty: () => 0n,
        short: each(string.short, ({ u }) => u.length),
        long: ({ p }) => p.units.length,
    }))

// The alphabet of a 6-bit unit: $, 0 to 9, A to Z, _ and a to z.
const alphabet = constant(array(u16, 64),
    [...'$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'].map(c => BigInt(c.charCodeAt(0))))
/** The code unit of a 6-bit code. A `u(6)` always indexes the table, so the read has no check. */
const fromId6 = fn({ c: Id6 }, u16, ({ c }) => alphabet.at(as(u(6), c)))

/** L0 `unit`: the code unit at index i, or a trap past the end. */
export const unit = fn({ s: string, i: u(31) }, u16, ({ s, i }) =>
    match_(s, {
        empty: () => trap('not an index'),
        short: {
            ...each(string.short, ({ u }) => u.at(i)),
            s8x6: ({ u }) => fromId6(u.at(i)),
        },
        long: ({ p }) => p.units.at(i),
    }))

/** L0 `from_unit`: the string of one unit. */
export const from_unit = fn({ c: u16 }, string, ({ c }) => string.short.s1x16({ u: [c] }))

// A string has one form: the short encoding of its length when its units
// fit, and an object otherwise.
const inline = string.only('empty', 'short')
const { some, none } = option(inline)
const id6 = option(Id6)
const code6 = e => id6.some(as(Id6, e))

/** The 6-bit code of a unit, by the ranges of the alphabet. */
const toId6 = fn({ c: u16 }, id6, ({ c }) =>
    if_(eq(c, 0x24n), code6(0n),
    if_(lt(c, 0x30n), id6.none,
    if_(le(c, 0x39n), code6(sub(c, 0x2Fn)), // 0 to 9 are 1 to 10
    if_(lt(c, 0x41n), id6.none,
    if_(le(c, 0x5An), code6(sub(c, 0x36n)), // A to Z are 11 to 36
    if_(eq(c, 0x5Fn), code6(37n),
    if_(lt(c, 0x61n), id6.none,
    if_(le(c, 0x7An), code6(sub(c, 0x3Bn)), // a to z are 38 to 63
        id6.none)))))))))

// Host functions that unroll over the units of a short string.
const indices = n => Array.from({ length: n }, (_, k) => BigInt(k))
/** Goes on with the payloads of the options, or answers `none` at the first that has none. */
const all = (options, then, got = []) => options.length === 0 ? then(got)
    : match_(options[0], { some: x => all(options.slice(1), then, [...got, x]), none: () => none })
const s16 = (n, p) => some(string.short[`s${n}x16`]({ u: indices(n).map(k => p.units.at(k)) }))
const s7 = (n, p) => all(indices(n).map(k => try_narrow(u(7), p.units.at(k))),
    u => some(string.short[`s${n}x7`]({ u })))

/** The short form of the units of an object, if they have one. */
export const pack = fn({ p: view(StrObj) }, option(inline), ({ p }) =>
    match_(p.units.length, {
        0: () => some(string.empty),
        1: () => s16(1, p),
        2: () => s16(2, p),
        3: () => s16(3, p),
        4: () => s7(4, p),
        5: () => s7(5, p),
        6: () => s7(6, p),
        7: () => s7(7, p),
        8: () => all(indices(8).map(k => toId6(p.units.at(k))), u => some(string.short.s8x6({ u }))),
        else: () => none,
    }))

/** Ends the building of a string. */
export const seal = fn({ d: own(uniq(StrObj)) }, string, ({ d }) =>
    match_(pack(d), {
        some: s => s,
        none: () => string.long.heap({ p: freeze(d) }),
    }))

/** A string literal, from the object that the compiler put into a data segment. */
export const literal = fn({ p: stat(StrObj) }, string, ({ p }) =>
    match_(pack(p), {
        some: s => s,
        none: () => string.long.lit({ p }),
    }))

/** Appends the units of `s` to the string that is being built. */
const append = fn({ d: own(uniq(StrObj)), s: string }, uniq(StrObj), ({ d, s }) =>
    loop_({ d: uniq(StrObj).of(d), i: u(31).of(0n) }, ({ d, i }, next) =>
        if_(lt(i, length(s)),
            next({ d: push(d, unit(s, i)), i: add(i, 1n) }),
            d)))

/** L0 `concat`: allocate once, fill, seal. */
export const concat = fn({ a: string, b: string }, string, ({ a, b }) =>
    let_({ n: narrow(u(31), add(length(a), length(b))) }, ({ n }) =>
        seal(append(append(alloc(StrObj, {}, n), a), b))))

// ── BigInt ───────────────────────────────────────────────────────────────

// The magnitude, from the least significant word, and the sign.
export const BigObj = object('BigObj', { negative: bool, words: tail(u64, u(31)) })

export const bigint = bits(64, {
    short: slot('bigint.short')('v…v', { v: i(52) }),
    long: reference('bigint', BigObj),
})

/** L0 `sign`: -1, 0 or 1. A long bigint is never zero. */
export const sign = fn({ b: bigint }, int(-1n, 1n), ({ b }) =>
    match_(b, {
        short: ({ v }) => if_(lt(v, 0n), -1n, if_(eq(v, 0n), 0n, 1n)),
        long: ({ p }) => if_(p.negative, -1n, 1n),
    }))

/** L0 `length` of a bigint: the number of 64-bit words of its magnitude. */
export const words = fn({ b: bigint }, u(31), ({ b }) =>
    match_(b, {
        short: ({ v }) => if_(eq(v, 0n), 0n, 1n),
        long: ({ p }) => p.words.length,
    }))

// The magnitude of an i64 is at most 2^63, which is a u64 and not an i64.
const abs = n => if_(lt(n, 0n), sub(0n, n), n)

/** A bigint from an integer of one word. */
export const from_i64 = fn({ n: i64 }, bigint, ({ n }) =>
    match_(try_narrow(i(52), n), {
        some: v => bigint.short({ v }),
        none: () => bigint.long.heap({
            p: freeze(push(alloc(BigObj, { negative: lt(n, 0n) }, 1n), abs(n))),
        }),
    }))

// ── Containers and Functions ─────────────────────────────────────────────

export const ArrObj = object('ArrObj', { items: tail(() => any, u(31)) })
export const ObjObj = object('ObjObj', { entries: tail({ key: string, value: () => any }, u(31)) })
export const FnObj = object('FnObj', {
    code: code([() => any, () => any], () => any),
    frame: () => any,
    length: u(31),
    text: string,
})

// ── The runtime ──────────────────────────────────────────────────────────
// The proof of the whole box runs here: no two patterns overlap, none holds
// a number, and each module stayed inside its slots.

export const groups = {
    string,
    bigint,
    array: reference('array', ArrObj),
    object: reference('object', ObjObj),
    function: reference('function', FnObj),
}
export const any = assemble(groups)
