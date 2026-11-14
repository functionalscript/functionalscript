// @ts-nocheck
// Runs the NaN box of nan-box-in-ir.box.mjs: the layout's proofs, what the
// layout derives against the README's own functions, and the functions
// against JavaScript. It accompanies nan-box-in-ir.md, sections 1 to 4.
// Run: node nan-box-in-ir.check.mjs
import assert from 'node:assert/strict'
import * as ir from './nan-box-in-ir.edsl.mjs'
import * as box from './nan-box-in-ir.box.mjs'
import { any as flat } from './nan-box-in-ir.flat.mjs'

const {
    Refused, Trap, array, bits, bool, carrier, classify, decisionTree, depth, evaluate, f64, f64c, fn, freeze,
    fromCarrier, int, leafOf, leaves, match_, numberTest, outside, pathOf, patternOf, ref, run, showTree, singleTest,
    stat, staticObject, subtype, u, u16, u64,
} = ir
const { any, frame, string, bigint, StrObj } = box

const hx = x => '0x' + x.toString(16).toUpperCase().padStart(16, '0').match(/.{4}/g).join('_')
const ALL = (1n << 64n) - 1n
let checks = 0
const ok = (c, message) => { checks++; assert.ok(c, message) }
const equal = (a, b, message) => { checks++; assert.equal(a, b, message) }

// a small generator, so that every run draws the same values
let seed = 0x9E37_79B9_7F4A_7C15n
const random64 = () => {
    seed ^= seed << 13n & ALL
    seed ^= seed >> 7n
    seed ^= seed << 17n & ALL
    return seed
}
const below = n => Number(random64() % BigInt(n))

// ── The README's functions, constant for constant ────────────────────────

const EXP = 0x7FF0_0000_0000_0000n
const TAG8 = 0x7FF0_0000_0000_00FFn
const NON_FINITE = 0x7FF0_0000_0000_0000n
const BOOL = 0x7FF0_0000_0000_0010n
const TAG2 = 0x7FF0_0000_0000_0003n
const SCALAR = 0x7FF0_0000_0000_0000n
const REF = 0x7FF0_0000_0000_0002n
const REF_TAG = 0xFFF0_0000_0000_0003n
const DYN_REF = 0x7FF0_0000_0000_0002n
const SHORT_BIGINT = 0x7FF0_0000_0000_0001n
const is_finite = x => (x & EXP) !== EXP
const is_number = x => is_finite(x) || (x & TAG8) === NON_FINITE
const is_bool = x => (x & TAG8) === BOOL
const is_short_string = x => (x & TAG2) === SCALAR && (x & 0xCn) !== 0n
const is_ref = x => (x & TAG2) === REF
const is_dyn_ref = x => (x & REF_TAG) === DYN_REF
const is_short_bigint = x => (x & SHORT_BIGINT) === SHORT_BIGINT
const typeof_ = x => is_finite(x) ? 0n
    : (x & 1n) === 1n ? 5n
    : (x & 2n) === 2n ? x >> 48n & 0xFn
    : (x & 0xCn) !== 0n ? 4n
    : x >> 4n & 0xFn

// ── 1. The layout ────────────────────────────────────────────────────────

const patterns = leaves(any).filter(l => l.payload === 'fields')
equal(patterns.length, 23)
// the box by module is the box in one piece
const inOnePiece = new Map(leaves(flat).map(l => [pathOf(flat, l), l.payload === 'f64c' ? 'f64c' : patternOf(l)]))
for (const l of leaves(any)) {
    equal(inOnePiece.get(pathOf(any, l)), l.payload === 'f64c' ? 'f64c' : patternOf(l), pathOf(any, l))
}
// a group that a module declared is the union's node, not a copy of it
ok(any.only('string') === string && any.string === string && any.only('bigint') === bigint)
// the README's constants
equal(carrier(evaluate(box.false_)), 0x7FF0_0000_0000_0010n)
equal(carrier(evaluate(box.true_)), 0xFFF0_0000_0000_0010n)
equal(carrier(evaluate(box.undefined_)), 0x7FF0_0000_0000_0020n)
equal(carrier(evaluate(box.null_)), 0x7FF0_0000_0000_0030n)
equal(carrier(evaluate(string.empty)), 0x7FF0_0000_0000_0008n)
equal(carrier(run(box.from_f64, Infinity)), 0x7FF0_0000_0000_0000n)
equal(carrier(run(box.from_f64, -Infinity)), 0xFFF0_0000_0000_0000n)
equal(carrier(run(box.from_f64, NaN)), 0x7FF8_0000_0000_0000n)
// no pattern holds the NaN that x86-64 makes for an invalid operation
const NEG_NAN = 0xFFF8_0000_0000_0000n
ok(patterns.every(l => outside(l) && outside(l, NEG_NAN)))
ok(is_number(NEG_NAN) && typeof_(NEG_NAN) === 0n)
console.log('1. layout: 23 patterns and the numbers; the box by module equals the box in one piece;')
console.log('   the README constants are values of their variants; no pattern holds either quiet NaN')

// ── 2. Samples ───────────────────────────────────────────────────────────

const top = l => pathOf(any, l).split('.')[0]
const samples = []
for (const l of patterns) {
    const free = ~l.mask & ALL
    for (const x of [l.value, l.value | free, ...Array.from({ length: 2000 }, () => l.value | random64() & free)]) {
        samples.push({ x, leaf: l })
    }
}
const number = leaves(any).find(l => l.payload === 'f64c')
const floats = [0n, 1n << 63n, 0x3FF0_0000_0000_0000n, 0xBFF0_0000_0000_0000n, 1n, 0x7FEF_FFFF_FFFF_FFFFn,
    0x7FF0_0000_0000_0000n, 0xFFF0_0000_0000_0000n, 0x7FF8_0000_0000_0000n]
for (let k = 0; k < 2000; k++) {
    const x = random64()
    if (is_finite(x)) { floats.push(x) }
}
for (const x of floats) { samples.push({ x, leaf: number }) }
for (const { x, leaf } of samples) { ok(leafOf(any, x) === leaf, hx(x)) }
console.log(`2. ${samples.length} values, each in its own variant alone`)

// ── 3. The tests that the frame derives, against the README's is_* functions ──

// Any is written over its frame, and every value of the union is in the slot of its kind
const frameTop = l => pathOf(frame, l).split('.')[0]
for (const { x, leaf } of samples) { equal(frameTop(leafOf(frame, x)), top(leaf), hx(x)) }
const pick = (t, f) => leaves(t).filter(l => f(pathOf(t, l)))
const show = t => `x & ${hx(t.mask)} == ${hx(t.value)}`
const derived = [
    ['is_bool', is_bool, p => p === 'boolean', [TAG8, BOOL]],
    ['is_ref', is_ref, p => /\.(heap|lit)$/.test(p), [TAG2, REF]],
    ['is_dyn_ref', is_dyn_ref, p => /\.heap$/.test(p), [REF_TAG, DYN_REF]],
    ['is_short_bigint', is_short_bigint, p => p === 'bigint.short', [SHORT_BIGINT, SHORT_BIGINT]],
]
console.log('3. one mask test for a set of variants, derived from the frame, with the bits it does not need dropped:')
for (const [name, readme, wanted, [mask, value]] of derived) {
    const t = singleTest(frame, pick(frame, wanted))
    for (const { x, leaf } of samples) {
        equal((x & t.mask) === t.value, wanted(pathOf(any, leaf)), `${name} ${hx(x)}`)
        equal(readme(x), wanted(pathOf(any, leaf)), `README ${name} ${hx(x)}`)
    }
    const same = t.mask === mask && t.value === value
    console.log(`   ${name.padEnd(16)}${show(t)}  ` +
        (same ? 'the README\'s constants' : `README: x & ${hx(mask)} == ${hx(value)}`))
}
// a number is a finite float, or one mask test more
const nt = numberTest(frame)
for (const { x, leaf } of samples) {
    equal((x & nt.exponent) !== nt.exponent || (x & nt.mask) === nt.value, leaf === number, hx(x))
    equal(is_number(x), leaf === number)
}
ok((NEG_NAN & nt.mask) === nt.value)
console.log(`   is_number       finite, or ${show(nt)}  ` +
    `README: finite, or x & ${hx(TAG8)} == ${hx(NON_FINITE)}`)
// the short strings are not one mask test, in the README or here
equal(singleTest(frame, pick(frame, p => /^string\.tag/.test(p))), undefined)
for (const { x, leaf } of samples) { equal(is_short_string(x), /^string\.(empty|short)/.test(pathOf(any, leaf))) }
console.log('   is_short_string is two tests in the README, and no single mask test exists: the tree finds it')

// ── 4. The decision trees that the frame derives ─────────────────────────

// the README's typeof_ is JavaScript's typeof, with 7 for the array tag
const typeofCode = { number: 0n, boolean: 1n, undefined: 2n, null: 3n, string: 4n, bigint: 5n, object: 3n, function: 6n, array: 7n }
const typeofTree = decisionTree(frame, l => typeofCode[frameTop(l)])
for (const { x } of samples) { equal(classify(typeofTree, x), typeof_(x), hx(x)) }
// L0's kind, with the tags of its ABI
const kindTag = { undefined: 0n, null: 1n, boolean: 2n, number: 3n, string: 4n, bigint: 5n, array: 6n, object: 7n, function: 8n }
const kindTree = decisionTree(frame, l => kindTag[frameTop(l)])
for (const { x, leaf } of samples) {
    equal(classify(kindTree, x), kindTag[top(leaf)])
    equal(run(box.kind, fromCarrier(x)), kindTag[top(leaf)])
}
// with both quiet NaNs in f64c, the tree still has a place for every pattern
const twoNans = decisionTree(frame, l => kindTag[frameTop(l)], [0x7FF8_0000_0000_0000n, NEG_NAN])
equal(classify(twoNans, NEG_NAN), 3n)
for (const { x, leaf } of samples) { equal(classify(twoNans, x), kindTag[top(leaf)]) }
console.log(`4. the derived tree for typeof agrees with the README's typeof_ (${depth(typeofTree)} tests at most),`)
console.log(`   and the derived tree for L0's kind agrees with the function \`kind\` (${depth(kindTree)} tests at most):`)
console.log(showTree(kindTree, '     ').trimEnd())

// ── 5. Why the frame, and not the union ──────────────────────────────────

// the same String with the slot that ends in 1000 left empty
const tag100 = box.slot('string.tag100')
const otherString = bits(64, {
    short: { s3x16: tag100('0_u…u_0', { u: array(u16, 3) }), s7x7: tag100('1_u…u', { u: array(u(7), 7) }) },
    long: box.reference('string', StrObj),
})
const other = box.assemble({ ...box.groups, string: otherString })
const isNull = p => p === 'null'
const isBool = p => p === 'boolean'
const fromFrame = [isBool, isNull].map(f => show(singleTest(frame, pick(frame, f))))
const fromUnion = [isBool, isNull].map(f => show(singleTest(any, pick(any, f))))
const fromOther = [isBool, isNull].map(f => show(singleTest(other, pick(other, f))))
// from the union, the test for null is true for a row of String's slot that String does not use today
equal(fromFrame[1], 'x & 0x7FF0_0000_0000_003F == 0x7FF0_0000_0000_0030')
equal(fromUnion[1], 'x & 0x7FF0_0000_0000_0037 == 0x7FF0_0000_0000_0030')
ok(leafOf(frame, 0x7FF0_0000_0000_0038n) === pick(frame, p => p === 'string.tag1000')[0])
equal(leafOf(any, 0x7FF0_0000_0000_0038n), undefined)
// and the test for a boolean changes with String's encodings
equal(fromUnion[0], fromFrame[0])
equal(fromOther[0], 'x & 0x7FF0_0000_0000_0037 == 0x7FF0_0000_0000_0010')
// the proof is modular: a group is checked against the node of its kind in the frame, without the other modules,
// and the frame's own patterns are disjoint, so two groups that pass cannot collide
for (const [name, group] of Object.entries(box.groups)) { ok(subtype(bits(64, { [name]: group }), frame.only(name)), name) }
ok(subtype(any, frame) && !subtype(frame, any))
ok(subtype(frame.only('number', 'boolean', 'undefined', 'null'), any))
// a value goes from a module's group to the frame, and from the frame's scalars to the union, at no cost
equal(run(fn({ s: string }, int(0n, 8n), ({ s }) => box.kind(s)), evaluate(string.empty)), 4n)
equal(carrier(run(fn({ x: f64 }, any, ({ x }) => box.from_f64(x)), 1)), 0x3FF0_0000_0000_0000n)
console.log('5. a test derived from the union would depend on what String puts into its slots:')
console.log(`   is_null  from the frame ${fromFrame[1]}`)
console.log(`            from the union ${fromUnion[1]}, true for a row of String's slot`)
console.log(`   is_bool  from the frame ${fromFrame[0]}, and the same from the union`)
console.log(`            from a union whose String leaves the slot 1000 empty ${fromOther[0]}`)

// ── 6. Any's functions ───────────────────────────────────────────────────

const traps = (f, reason) => {
    checks++
    assert.throws(f, e => e instanceof Trap && e.message === reason)
}
const bitsOf = x => new BigUint64Array(new Float64Array([x]).buffer)[0]
for (const x of [0, -0, 1, -1.5, 5e-324, 1.7976931348623157e308, Infinity, -Infinity, 2 ** 53, 0.1]) {
    const v = run(box.from_f64, x)
    equal(carrier(v), bitsOf(x))
    ok(Object.is(run(box.to_f64, v), x))
    equal(run(box.kind, v), 3n)
}
ok(Number.isNaN(run(box.to_f64, run(box.from_f64, NaN))))
for (const b of [false, true]) {
    equal(run(box.to_bool, run(box.from_bool, b)), b)
    equal(carrier(run(box.from_bool, b)), carrier(evaluate(b ? box.true_ : box.false_)))
}
traps(() => run(box.to_f64, evaluate(box.undefined_)), 'not a number')
traps(() => run(box.to_bool, run(box.from_f64, 1)), 'not a boolean')
// `same` takes containers only
const arrays = [0x1000n, 0x2000n].map(a => fromCarrier(0x7FF7_0000_0000_0002n | a))
equal(run(box.same, arrays[0], arrays[0]), true)
equal(run(box.same, arrays[0], arrays[1]), false)
checks++
assert.throws(() => run(box.same, evaluate(box.null_), arrays[0]), Refused)
console.log('6. Any: kind, to_f64, from_f64, to_bool, from_bool, same and the four constants')

// ── 7. String ────────────────────────────────────────────────────────────

const unitsOf = s => Array.from({ length: s.length }, (_, k) => BigInt(s.charCodeAt(k)))
/** A string of the host as a literal of a program. */
const lit = s => run(box.literal, staticObject(StrObj, {}, unitsOf(s)))
const text = v => {
    let r = ''
    for (let k = 0n, n = run(box.length, v); k < n; k++) { r += String.fromCharCode(Number(run(box.unit, v, k))) }
    return r
}
/** The encoding that a string must have, written apart from nan-box-in-ir.box.mjs. */
const encoding = (s, long) => {
    const n = s.length
    const ascii = unitsOf(s).every(c => c < 0x80n)
    return n === 0 ? 'empty'
        : n <= 3 ? `short.s${n}x16`
        : n <= 7 && ascii ? `short.s${n}x7`
        : n === 8 && /^[$0-9A-Z_a-z]*$/.test(s) ? 'short.s8x6'
        : long
}
const strings = ['', 'a', '\u0000', '￿', 'ab', '😀', 'abc', '\u0000￿耀', 'abcd', 'abc\u0080',
    '\u007F\u007F\u007F\u007F', 'abcde', 'abcdé', 'abcdef', 'привет', 'abcdefg', '\u007F'.repeat(7), 'abcdefgh',
    '$0189AZ_', 'az_$zzzz', '$$$$$$$$', 'zzzzzzzz', 'abcdefg!', 'abcdefg ', 'abcdefghi', 'hello, world']
const alphabets = ['ab', '$09AZ_az', 'a\u007F\u0080', '\u0000￿x']
for (let k = 0; k < 300; k++) {
    const alphabet = alphabets[below(alphabets.length)]
    strings.push(Array.from({ length: below(11) }, () => alphabet[below(alphabet.length)]).join(''))
}
const seen = new Set()
for (const s of strings) {
    const v = lit(s)
    const path = pathOf(string, leafOf(string, carrier(v)))
    seen.add(path)
    equal(path, encoding(s, 'long.lit'), JSON.stringify(s))
    equal(run(box.length, v), BigInt(s.length))
    equal(text(v), s)
    traps(() => run(box.unit, v, BigInt(s.length)), 'not an index')
    equal(run(box.kind, v), 4n)
}
equal(seen.size, 10) // every encoding but `long.heap`
for (const c of [0n, 0x41n, 0xFFFFn]) {
    equal(carrier(run(box.from_unit, c)), carrier(lit(String.fromCharCode(Number(c)))))
}
let concats = 0
for (const a of strings.slice(0, 40)) {
    for (const b of strings.slice(0, 40)) {
        const v = run(box.concat, lit(a), lit(b))
        const path = pathOf(string, leafOf(string, carrier(v)))
        equal(path, encoding(a + b, 'long.heap'))
        equal(text(v), a + b)
        // one string, one form: a short result is the bits of the same literal
        if (path !== 'long.heap') { equal(carrier(v), carrier(lit(a + b))) }
        concats++
    }
}
console.log(`7. String: ${strings.length} literals in all ten of their encodings, read back by length and unit;`)
console.log(`   from_unit; ${concats} concats, each the string and the encoding that JavaScript's + and the rule give`)

// ── 8. BigInt ────────────────────────────────────────────────────────────

const long = bigint.only('long')
// a field that both encodings of a group share is read without a match
const magnitude = fn({ b: long }, u64, ({ b }) => b.p.words.at(0n))
const negative = fn({ b: long }, bool, ({ b }) => b.p.negative)
const ints = [0n, 1n, -1n, 42n, -42n, 2n ** 51n - 1n, -(2n ** 51n), 2n ** 51n, -(2n ** 51n) - 1n, 2n ** 63n - 1n, -(2n ** 63n)]
for (let k = 0; k < 200; k++) { ints.push(BigInt.asIntN(64, random64()) >> BigInt(below(64))) }
for (const n of ints) {
    const v = run(box.from_i64, n)
    const x = carrier(v)
    const short = -(2n ** 51n) <= n && n < 2n ** 51n
    equal(pathOf(bigint, leafOf(bigint, x)), short ? 'short' : 'long.heap', String(n))
    equal(run(box.sign, v), n < 0n ? -1n : n === 0n ? 0n : 1n)
    equal(run(box.words, v), n === 0n ? 0n : 1n)
    equal(run(box.kind, v), 5n)
    if (short) {
        // the field by hand: the box's sign bit, then bits 51 to 1
        equal(BigInt.asIntN(52, (x >> 63n) << 51n | x >> 1n & (1n << 51n) - 1n), n)
        ok(is_short_bigint(x))
    } else {
        equal(run(magnitude, v), n < 0n ? -n : n)
        equal(run(negative, v), n < 0n)
        ok(is_dyn_ref(x) && typeof_(x) === 5n)
    }
}
console.log(`8. BigInt: ${ints.length} integers through from_i64, with sign and the word count`)

// ── 9. What is refused ───────────────────────────────────────────────────

const refused = (name, f) => {
    checks++
    assert.throws(f, e => {
        if (process.argv.includes('--reasons')) { console.log(`   ${name}: ${e.message}`) }
        return e instanceof Refused
    }, name)
    return name
}
const s3 = array(u16, 3)
const names = [
    refused('a payload that is wider than its slot', () => box.slot('string.tag1000')('0_u…u_0', { u: array(u16, 3) })),
    refused('a second module in a slot that is taken', () => bits(64, {
        bigint,
        decimal: { short: box.slot('bigint.short')('d…d', { d: u(52) }) },
    })),
    refused('a pattern outside the slots of its kind', () => box.assemble({
        ...box.groups,
        string: bits(64, { odd: '0111_1111_1111_0…0_0100_0000' }),
    })),
    refused('a string in the slot of the bigint', () => box.assemble({
        ...box.groups,
        string: bits(64, { odd: box.slot('bigint.short')('0…0') }),
        bigint: bits(64, { long: box.reference('bigint', box.BigObj) }),
    })),
    refused('a pattern that leaves a bit of the frame open', () => box.assemble({
        ...box.groups,
        string: bits(64, {
            long: {
                heap: ['0111_1111_1111_t100_p…p_10', { t: bool, p: ref(StrObj) }],
                lit: ['1111_1111_1111_0100_p…p_10', { p: stat(StrObj) }],
            },
        }),
    })),
    refused('a reference hidden in a slot', () => box.assemble({
        ...box.groups,
        string: bits(64, {
            hidden: box.slot('string.tag100')('0_p…p_0', { p: ref(StrObj) }),
            long: box.reference('string', StrObj),
        }),
    })),
    refused('an inline value where the frame has a reference', () => box.assemble({
        ...box.groups,
        string: bits(64, {
            long: {
                heap: ['0111_1111_1111_0100_u…u_10', { u: u(46) }],
                lit: ['1111_1111_1111_0100_p…p_10', { p: stat(StrObj) }],
            },
        }),
    })),
    refused('a group passed off as the frame with a reference of another mode', () => run(
        fn({ v: bits(64, { s: ['0111_1111_1111_0100_p…p_10', { p: stat(StrObj) }] }) }, int(0n, 8n), ({ v }) => box.kind(v)),
        fromCarrier(0x7FF4_0000_0000_1002n))),
    refused('a pattern that holds a number', () => bits(64, { number: f64c, flag: ['f111_1111_1111_0…0', { f: bool }] })),
    refused('a pattern that holds the NaN', () => bits(64, { number: f64c, odd: '0111_1111_1111_1000_0…0' })),
    refused('a field that is wider than its pattern', () => bits(64, { s: ['0111_1111_1111_u…u_0100', { u: array(u16, 4) }] })),
    refused('a field without a type', () => bits(64, { s: '0111_1111_1111_u…u_0100' })),
    refused('a match that leaves a variant out', () => run(fn({ v: any }, bool, ({ v }) =>
        match_(v, { number: () => true, string: () => false })), evaluate(box.null_))),
    refused('an arm for a variant that the type excludes', () => run(fn({ s: string }, bool, ({ s }) =>
        match_(s, { number: () => true, else: () => false })), evaluate(string.empty))),
    refused('a float that was not made canonical', () => run(fn({ x: f64 }, any, ({ x }) => any.number(x)), 1)),
    refused('an any where a string is needed', () => run(fn({ v: any }, u(31), ({ v }) => box.length(v)), evaluate(box.null_))),
    refused('a field that the encodings of a group do not share', () => run(fn({ s: string.short }, s3, ({ s }) => s.u),
        lit('abc'))),
    refused('a view stored as a counted reference', () => run(fn({ s: string.only('long') }, string, ({ s }) =>
        string.long.heap({ p: s.p })), lit('a long string'))),
    refused('a frozen object frozen again', () => run(fn({ s: string.only('long.heap') }, string, ({ s }) =>
        string.long.heap({ p: freeze(s.p) })), run(box.concat, lit('a long '), lit('string')))),
    refused('a signed field read as unsigned', () => run(fn({ b: bigint.only('short') }, u(52), ({ b }) => b.v),
        run(box.from_i64, -1n))),
    refused('a 6-bit code used as a code unit', () => run(fn({ s: string.only('short.s8x6') }, u16, ({ s }) =>
        s.u.at(0n)), lit('abcdefgh'))),
    refused('a value of the frame passed off as one of the union', () => run(fn({ v: frame }, any, ({ v }) => v),
        evaluate(box.null_))),
]
console.log(`9. refused: ${names.join('; ')}`)
console.log(`\n${checks} checks passed`)
