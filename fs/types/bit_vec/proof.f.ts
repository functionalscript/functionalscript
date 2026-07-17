import { assert, assertEq } from '../../asserts/module.f.ts'
import { mask } from '../bigint/module.f.ts'
import type { Sign } from '../function/compare/module.f.ts'
import { asBase, asNominal } from '../nominal/module.f.ts'
import { length, empty, uint, type Vec, vec, lsb, msb, type BitOrder, repeat, vec8, maxLength, u8ListToVec, tryU8ListToVec, u8List, chunkList, fromSentinel } from './module.f.ts'
import { repeat as listRepeat, toArray, type List } from '../list/module.f.ts'

const unsafeVec = (a: bigint): Vec => asNominal(a)

// 0x8 = 0b1000 = 0 + 8
// 0x9 = 0b1001 = 1 + 8
// 0xA = 0b1010 = 2 + 8
// 0xB = 0b1011 = 3 + 8
// 0xC = 0b1100 = 4 + 8
// 0xD = 0b1101 = 5 + 8
// 0xE = 0b1110 = 6 + 8
// 0xF = 0b1111 = 7 + 8

const assertEq2 = <T>([a0, a1]: readonly[bigint, T], [b0, b1]: readonly[bigint, T]) => {
    assertEq(a0, b0)
    assertEq(a1, b1)
}

const frontTest = (e: BitOrder) => (r0: bigint) => (r1: bigint) => () => {
    const vector = vec(8n)(0xF5n) // 0xF5n
    assert(vector === unsafeVec(0xF5n), vector)
    const result = e.front(4n)(vector)
    assert(result === r0, result)
    const result2 = e.front(16n)(vector)
    assert(result2 === r1, result2)
}

const popFront = (e: BitOrder) => ([r00, r01]: readonly [bigint, bigint]) => ([r10, r11]: readonly [bigint, bigint]) => () => {
    const vector = vec(8n)(0xF5n) // 0xF5n
    const [result, rest] = e.popFront(4n)(vector)
    assert(result === r00, result)
    assert(rest === unsafeVec(r01), rest)
    const [result2, rest2] = e.popFront(16n)(vector)
    assert(result2 === r10, result2)
    assert(rest2 === unsafeVec(r11), rest2)
}

const removeFront = (e: BitOrder) => (r0: Vec) => (r1: Vec) => () => {
    const v = vec(16n)(0x3456n) // -0xB456n
    assert(v === unsafeVec(-0xB456n), v)
    const r = e.removeFront(4n)(v)
    assert(r === r0, r)
    const r2 = e.removeFront(24n)(v)
    assert(r2 === r1, r2)
}

const concat = (e: BitOrder) => (r: Vec) => () => {
    const u8 = vec(8n)
    const a = u8(0x45n) // -0xC5n
    assert(a === unsafeVec(-0xC5n), a)
    const b = u8(0x89n) // 0x89n
    assert(b === unsafeVec(0x89n), b)
    const ab = e.concat(a)(b) // 0x8945n
    assert(ab === r, ab)
}

export const proof = {
    fromSentinel: () => {
        // Two data bytes; the leading 0x1 nibble is the sentinel, stripped out.
        const v = fromSentinel(0x1_89_50n)
        assertEq(length(v), 16n)
        assertEq(uint(v), 0x8950n)
        // Leading zero bytes survive because the sentinel pins the length.
        const z = fromSentinel(0x1_00_05n)
        assertEq(length(z), 16n)
        assertEq(uint(z), 0x0005n)
        // A bare sentinel yields the empty vector.
        assertEq(fromSentinel(0x1n), empty)
    },
    examples: {
        vec: () => {
            const vec4 = vec(4n)
            const v0 = vec4(5n) // 0b0101 => -0b1101
            assert(v0 === unsafeVec(-0xDn), v0)
            const v1 = vec4(0x5FEn) // 0xEn
            assert(v1 === unsafeVec(0xEn), v1)
        },
        uint: () => {
            const vector = vec(8n)(0x5n) // -0x85n
            assert(vector === unsafeVec(-0x85n), vector)
            const result = uint(vector) // result is 0x5n
            assert(result === 0x5n, result)
        },
        front: () => {
            const vector = vec(8n)(0xF5n) // 0xF5n

            assertEq(lsb.front(4n)(vector), 5n)
            assertEq(lsb.front(16n)(vector), 0xF5n)

            assertEq(msb.front(4n)(vector), 0xFn)
            assertEq(msb.front(16n)(vector), 0xF500n)
        },
        removeFront: () => {
            const v = vec(16n)(0x3456n) // -0xB456n

            assertEq(lsb.removeFront(4n)(v), asNominal(-0xB45n))
            assertEq(lsb.removeFront(24n)(v), empty)

            assertEq(msb.removeFront(4n)(v), asNominal(-0xC56n))
            assertEq(msb.removeFront(24n)(v), empty)
        },
        popFront: () => {
            const vector = vec(8n)(0xF5n) // 0xF5n

            assertEq2(lsb.popFront(4n)(vector), [5n, asNominal(0xFn)])
            assertEq2(lsb.popFront(16n)(vector), [0xF5n, empty])

            assertEq2(msb.popFront(4n)(vector), [0xFn, asNominal(-0xDn)])
            assertEq2(msb.popFront(16n)(vector), [0xF500n, empty])
        },
        concat: () => {
            const u8 = vec(8n)
            const a = u8(0x45n) // -0xC5n
            const b = u8(0x89n) // 0x89n

            assertEq(lsb.concat(a)(b), asNominal(0x8945n))
            assertEq(msb.concat(a)(b), asNominal(-0xC589n))
        }
    },
    front: {
        lsbf: frontTest(lsb)(5n)(0xF5n),
        msbf: frontTest(msb)(0xFn)(0xF500n),
    },
    popFront: {
        lsbm: popFront(lsb)([5n, 0xFn])([0xF5n, 0n]),
        msbm: popFront(msb)([0xFn, -0xDn])([0xF500n, 0n]),
    },
    removeFront: {
        lsbm: removeFront(lsb)(asNominal(-0xB45n))(empty),
        msbm: removeFront(msb)(asNominal(-0xC56n))(empty),
    },
    concat: {
        lsbm: concat(lsb)(asNominal(0x8945n)),
        msbm: concat(msb)(asNominal(-0xC589n)),
    },
    uintLsb: () => {
        const vector: Vec = asNominal(0b110101n)
        const extract3Bits = lsb.front(3n)
        const result = extract3Bits(vector) // result is 0b101n (5n)
        assert(result === 0b101n, result)
    },
    uintSmall: () => {
        const vector: Vec = asNominal(0b1n)
        const extract3Bits = lsb.front(3n)(vector)
        assert(extract3Bits === 0b1n, extract3Bits)
    },
    vecExample: () => {
        const createVector = vec(4n)
        const vector = createVector(5n) // vector is -0b1101n
        assert(vector === unsafeVec(-0b1101n), vector)
    },
    length: () => {
        const len = length(empty)
        assert(len === 0n, len)
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        assert(v === unsafeVec(0xFEn), v)
        assert(length(v) === 8n, 'len')
        const u = lsb.front(8n)(v)
        assert(u === 0xFEn, v)
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = lsb.concat(a)(b)
        assert(ab === unsafeVec(0x8945n), ab)
        const s = length(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        assert(v === unsafeVec(0x12345n), (asBase(v) as bigint).toString(16))
        const r = lsb.removeFront(9n)(v)
        assert(r === unsafeVec(0x91n), (asBase(r) as bigint).toString(16))
    },
    uint: [
        // 0
        () => {
            const x = uint(asNominal(0n))
            assert(x === 0n, x)
        },
        // 1
        () => {
            const v: Vec = asNominal(1n)
            const x = uint(v)
            assert(x === 1n, x)
            const len = length(v)
            assert(len === 1n, len)
        },
        // 2
        () => {
            const v: Vec = asNominal(0b10n)
            const x = uint(v)
            assert(x === 0b10n, x)
            const len = length(v)
            assert(len === 2n, len)
        },
        // 3
        () => {
            const v: Vec = asNominal(0b11n)
            const x = uint(v)
            assert(x === 0b11n, x)
            const len = length(v)
            assert(len === 2n, len)
        },
        // 4
        () => {
            const v: Vec = asNominal(-1n)
            const x = uint(v)
            assert(x === 0n, x)
            const len = length(v)
            assert(len === 1n, len)
        },
        () => {
            const v: Vec = asNominal(-0b10n)
            const x = uint(v)
            assert(x === 0n, x)
            const len = length(v)
            assert(len === 2n, len)
        },
        () => {
            const v: Vec = asNominal(-0b11n)
            const x = uint(v)
            assert(x === 1n, x)
            const len = length(v)
            assert(len === 2n, len)
        }
    ],
    vec: [
        // 0
        () => {
            const v = asBase(vec(0n)(0n))
            assert(v === 0n, v)
        },
        () => {
            const v = asBase(vec(0n)(1n))
            assert(v === 0n, v)
        },
        () => {
            const v = asBase(vec(0n)(-1n))
            assert(v === 0n, v)
        },
        // 1
        () => {
            const v = asBase(vec(1n)(0n))
            assert(v === -1n, v)
        },
        () => {
            const v = asBase(vec(1n)(1n))
            assert(v === 1n, v)
        },
        () => {
            const v = asBase(vec(1n)(-1n))
            assert(v === 1n, v)
        },
        () => {
            const v = asBase(vec(1n)(0b10n))
            assert(v === -1n, v)
        },
        () => {
            const v = asBase(vec(1n)(0b11n))
            assert(v === 1n, v)
        }
    ],
    both: () => {
        const c = (len: bigint) => (ui: bigint) => (raw: bigint) => {
            const v = vec(len)(ui)
            const x = asBase(v)
            if (x !== raw) { throw `x: ${x}, raw: ${raw}` }
            const len2 = length(v)
            assert(len2 === len, len2)
            const u = uint(v)
            const mui = mask(len) & ui
            assert(u === mui, [u, mui])
        }
        // 0n
        for (const i of [0n, 1n, -1n, 2n, -2n, 3n, -3n]) {
            c(0n)(i)(0n)
        }
        return [
            // 1n
            () => c(1n)(0n)(-1n),
            () => c(1n)(1n)(1n),
            () => c(1n)(-11n)(1n), //< overflow
            // 2n
            () => c(2n)(0n)(-0b10n),
            () => c(2n)(1n)(-0b11n),
            () => c(2n)(0b10n)(0b10n),
            () => c(2n)(0b11n)(0b11n),
            // -1 is 0b.....1
            // -2 is 0b....10
            // -3 is 0b...101
            // -4 is 0b...100
            // -5 is 0b..1011
            // -6 is 0b..1010
            // -7 is 0b..1011, cut 0b11, vec: -0b11
            // -8 is 0b..1100 = ~(8-1) = ~7
            () => c(2n)(-0b111n)(-0b11n), //< overflow.
        ]
    },
    concat2: () => {
        const c = (a: Vec) => (b: Vec) => (abx: Vec) => {
            const ab = msb.concat(a)(b)
            const abLen = length(ab)
            const abxLen = length(abx)
            assert(abLen === abxLen, abLen)
            const abU = uint(ab)
            const abxU = uint(abx)
            assert(abU === abxU, abU)
        }
        c(vec(4n)(0xFn))(vec(8n)(0xA7n))(vec(12n)(0xFA7n))
        c(vec(4n)(0xFn))(vec(8n)(0x57n))(vec(12n)(0xF57n))
        c(vec(4n)(0x5n))(vec(8n)(0xA7n))(vec(12n)(0x5A7n))
        c(vec(4n)(0x5n))(vec(8n)(0x79n))(vec(12n)(0x579n))
    },
    lsbXor: () => {
        const c = (a: Vec) => (b: Vec) => (e: Vec) => {
            const r = lsb.xor(a)(b)
            assert(r === e, r)
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x7n ^ 0x12n))
    },
    msbXor: () => {
        const c = (a: Vec) => (b: Vec) => (e: Vec) => {
            const r = msb.xor(a)(b)
            assert(r === e, r)
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x70n ^ 0x12n))
    },
    repeat: () => {
        assert(repeat(4n)(vec8(0xA5n)) === vec(32n)(0xA5A5A5A5n), 'repeat failed')
        assert(repeat(7n)(vec(5n)(0x13n)) === vec(35n)(0b10011_10011_10011_10011_10011_10011_10011n), 'repeat failed')
    },
    lsbCmp: () => {
        const c = (a: Vec) => (b: Vec) => (r: Sign) => {
            const result = lsb.cmp(a)(b)
            if (result !== r) { throw `result: ${result}, expected: ${r}` }
        }
        c(vec(4n)(0x5n))(vec(4n)(0x5n))(0)   // [1,0,1,0] == [1,0,1,0]
        c(vec(4n)(0x5n))(vec(4n)(0x6n))(1)   // bit0: 1 > 0
        c(vec(4n)(0x6n))(vec(4n)(0x5n))(-1)  // bit0: 0 < 1
        c(vec(4n)(0x5n))(vec(5n)(0x5n))(-1)  // equal prefix, shorter is less
        c(vec(5n)(0x5n))(vec(4n)(0x5n))(1)   // equal prefix, longer is greater
        c(vec(4n)(0x5n))(vec(5n)(0xAn))(1)   // bit0: 1 > 0
    },
    msbCmp: () => {
        const c = (a: Vec) => (b: Vec) => (r: Sign) => {
            const result = msb.cmp(a)(b)
            if (result !== r) { throw `result: ${result}, expected: ${r}` }
        }
        c(vec(4n)(0x5n))(vec(4n)(0x5n))(0)  // 0b0101 == 0b0101
        c(vec(4n)(0x5n))(vec(4n)(0x6n))(-1) // 0b0101 < 0b0110
        c(vec(4n)(0x6n))(vec(4n)(0x5n))(1)  // 0b0110 > 0b0101
        c(vec(4n)(0x5n))(vec(5n)(0x5n))(1)  // 0b0101_ < 0b00101
        c(vec(5n)(0x5n))(vec(4n)(0x5n))(-1) // 0b00101 < 0b0101_
        c(vec(4n)(0x5n))(vec(5n)(0xAn))(-1) // 0b0101_ < 0b01010
    },
    startsWith: {
        // vector 0xF5 = 0b1111_0101 (8 bits)
        // LSB reads from the low end: bits 0-3 = 0101 = 0x5, bits 4-7 = 1111 = 0xF
        lsb: () => {
            const v = vec(8n)(0xF5n)
            assertEq(lsb.startsWith(vec(4n)(0x5n))(v), true)   // low nibble matches
            assertEq(lsb.startsWith(vec(4n)(0xFn))(v), false)  // low nibble doesn't match
            assertEq(lsb.startsWith(v)(vec(4n)(0x5n)), false)  // prefix longer than vector
            assertEq(lsb.startsWith(empty)(v), true)            // empty prefix always matches
        },
        // MSB reads from the high end: bits 0-3 = 1111 = 0xF, bits 4-7 = 0101 = 0x5
        msb: () => {
            const v = vec(8n)(0xF5n)
            assertEq(msb.startsWith(vec(4n)(0xFn))(v), true)   // high nibble matches
            assertEq(msb.startsWith(vec(4n)(0x5n))(v), false)  // high nibble doesn't match
            assertEq(msb.startsWith(v)(vec(4n)(0xFn)), false)  // prefix longer than vector
            assertEq(msb.startsWith(empty)(v), true)            // empty prefix always matches
        },
        emptyVec: () => {
            assertEq(lsb.startsWith(empty)(empty), true)
            assertEq(msb.startsWith(empty)(empty), true)
        },
    },
    u8ListToVec: () => {
        // 131_072 is too much for Bun
        const x = u8ListToVec(msb)(listRepeat(0x12)(131_071))
        return () => {
            const m = u8List(msb)(x)
            const y = toArray(m)
            if (y.length !== 131_071) {
                throw `y.lenght: ${y.length}`
            }
        }
    },
    tryListToVecOverflow: () => {
        const list: List<Vec> = [vec(maxLength)(1n), vec(1n)(1n)]
        assertEq(lsb.tryListToVec(list), null)
        assertEq(msb.tryListToVec(list), null)
    },
    listToVecOverflow: {
        // Same oversized input, but through the throwing `listToVec` wrapper.
        throw: () => {
            const list: List<Vec> = { first: vec(maxLength + 1n)(1n), tail: null }
            lsb.listToVec(list)
        },
    },
    u8ListToVecOverflow: {
        // 131_073 bytes is 8 bits past `maxLength`; same null/throw split as
        // `tryListToVec`/`listToVec` above, exercised through the byte-list API.
        try: () => {
            assertEq(tryU8ListToVec(msb)(listRepeat(0x12)(131_073)), null)
        },
        throw: () => {
            u8ListToVec(msb)(listRepeat(0x12)(131_073))
        },
    },
    u8ListUnaligned: () => {
        const x = vec(9n)(0x83n)
        const a = toArray(u8List(msb)(x))
        if (a.length !== 2) {
            throw `a.lenght: ${a.length}`
        }
        const [a0, a1] = a
        if (a0 !== 0x41) {
            throw `a0: ${a0.toString(16)}`
        }
        if (a1 !== 0x80) {
            throw `a1: ${a1.toString(16)}`
        }
    },
    chunkList: {
        empty: () => {
            const chunks = toArray(chunkList(lsb)(4n)(empty))
            assert(chunks.length === 0, chunks.length)
        },
        // 8-bit vector 0xF5 = 0b1111_0101, aligned to 4-bit chunks
        lsb_aligned: () => {
            const chunks = toArray(chunkList(lsb)(4n)(vec(8n)(0xF5n)))
            // LSB: low nibble first — bits 0-3 = 0101 = 5, bits 4-7 = 1111 = 15
            assert(chunks.length === 2, chunks.length)
            assert(!(length(chunks[0]) !== 4n || uint(chunks[0]) !== 5n), chunks[0])
            assert(!(length(chunks[1]) !== 4n || uint(chunks[1]) !== 0xFn), chunks[1])
        },
        msb_aligned: () => {
            const chunks = toArray(chunkList(msb)(4n)(vec(8n)(0xF5n)))
            // MSB: high nibble first — bits 0-3 = 1111 = 15, bits 4-7 = 0101 = 5
            assert(chunks.length === 2, chunks.length)
            assert(!(length(chunks[0]) !== 4n || uint(chunks[0]) !== 0xFn), chunks[0])
            assert(!(length(chunks[1]) !== 4n || uint(chunks[1]) !== 5n), chunks[1])
        },
        // 10-bit vector 0x1B5 = 0b01_1011_0101, unaligned to 4-bit chunks (last chunk is 2 bits)
        lsb_unaligned: () => {
            const chunks = toArray(chunkList(lsb)(4n)(vec(10n)(0x1B5n)))
            // LSB: bits 0-3 = 0101 = 5, bits 4-7 = 1011 = 11, bits 8-9 = 01 = 1
            assert(chunks.length === 3, chunks.length)
            assert(!(length(chunks[0]) !== 4n || uint(chunks[0]) !== 5n), chunks[0])
            assert(!(length(chunks[1]) !== 4n || uint(chunks[1]) !== 0xBn), chunks[1])
            assert(!(length(chunks[2]) !== 2n || uint(chunks[2]) !== 1n), chunks[2])
        },
        msb_unaligned: () => {
            const chunks = toArray(chunkList(msb)(4n)(vec(10n)(0x1B5n)))
            // MSB: bits 0-3 = 0110 = 6, bits 4-7 = 1101 = 13, bits 8-9 = 01 = 1
            assert(chunks.length === 3, chunks.length)
            assert(!(length(chunks[0]) !== 4n || uint(chunks[0]) !== 6n), chunks[0])
            assert(!(length(chunks[1]) !== 4n || uint(chunks[1]) !== 0xDn), chunks[1])
            assert(!(length(chunks[2]) !== 2n || uint(chunks[2]) !== 1n), chunks[2])
        },
    },
}
