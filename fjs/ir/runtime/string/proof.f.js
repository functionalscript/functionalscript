/**
 * Proofs of the String runtime-module skeleton, short pack/unpack bit
 * round-trips (S1), and the B IR module for linked length/unit (S3)
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md)).
 *
 * @import { ShortTag } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { check, checkPlain } from '../../check/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { definedBy } from '../../module.f.js'
import {
    EMPTY, a, allTags, atAlias, b, c, isShort, length, maxEnabledLen, ops, pack, packEnabled,
    tagLen, tagOf, unit, unpack, v1EnabledTags, variants,
} from './module.f.js'
import { module as irModule } from './ir.f.js'

/** @type {(s: string) => readonly number[]} */
const unitsOf = s => [...s].map(ch => /** @type {number} */ (ch.codePointAt(0)))

/** @type {(units: readonly number[]) => string} */
const textOf = units => String.fromCharCode(...units)

/** @type {(units: readonly number[], i: number) => number} */
const atUnit = (units, i) => units[Number(i)]

/** @type {(f: import('./types.ts').FunctionForm) => string} */
const formOp = f => f.kind === 'null' ? '' : f.op

export const proof = {
    // Shared logical surface: unpack / length / unit (at is the same op).
    ops: () => {
        assertEq(ops.join(), 'unpack,length,unit')
        assertEq(atAlias, 'at')
        assertEq(variants.map(v => v.id).join(), 'A,B,C')
    },
    // Emit hosts skip packing when length exceeds every enabled tag.
    maxLen: () => {
        assertEq(tagLen.empty, 0)
        assertEq(tagLen.s8x6, 8)
        assertEq(maxEnabledLen([]), -1)
        assertEq(maxEnabledLen(v1EnabledTags), 2)
        assertEq(maxEnabledLen(allTags), 8)
        assertEq(maxEnabledLen(['empty']), 0)
    },
    // A: import-form baseline, never a short box.
    manifestA: () => {
        assertEq(a.id, 'A')
        assertEq(a.slots.length, 0)
        assertEq(a.unpack.kind, 'null')
        assertEq(a.length.kind, 'import')
        assertEq(formOp(a.length), 'length')
        assertEq(a.unit.kind, 'import')
        assertEq(formOp(a.unit), 'unit')
        assertEq(a.emit.kind, 'alwaysDynRef')
        assertEq(a.enabledTags.length, 0)
        assertEq(a.requiresAny, 'any')
        assertEq(a.longPath, 'fjs:l0')
        assertEq(a.moduleName, 'fjs:l0/string')
        assertEq(a.version, '1')
        assertEq(packEnabled(unitsOf('hi'), a.enabledTags)[0], 'error')
    },
    // B: memory-saving; v1 tags; templates re-decode; no slots.
    manifestB: () => {
        assertEq(b.id, 'B')
        assertEq(b.slots.length, 0)
        assertEq(b.unpack.kind, 'null')
        assertEq(b.length.kind, 'template')
        assertEq(formOp(b.length), 'length')
        assertEq(b.unit.kind, 'template')
        assertEq(formOp(b.unit), 'unit')
        assertEq(b.emit.kind, 'shortWhenEnabled')
        assertEq(b.requiresAny, 'nan')
        assertEq(b.moduleName, 'fjs:ir/string/memory')
        assertEq(b.longPath, 'fjs:l0')
        assertEq(b.enabledTags.join(), v1EnabledTags.join())
        assertEq(assertOk(packEnabled([], b.enabledTags)), EMPTY)
        assertEq(assertOk(tagOf(assertOk(packEnabled(unitsOf('a'), b.enabledTags)))), 's1x16')
        assertEq(assertOk(tagOf(assertOk(packEnabled(unitsOf('ab'), b.enabledTags)))), 's2x16')
        // four ASCII units fit s4x7, but that tag is not enabled → force long
        assertEq(packEnabled(unitsOf('abcd'), b.enabledTags)[0], 'error')
        // U+0080 does not fit 4×7 either; still long, not refused as a third outcome
        assertEq(pack(unitsOf('ab\u0080c'))[0], 'error')
    },
    // C: CPU-saving provisional C-flag layout; same enabled set as B.
    manifestC: () => {
        assertEq(c.id, 'C')
        assertEq(c.layout, 'C-flag')
        assertEq(c.slots.length, 10)
        assertEq(c.slots.join(), 'i32,i32,i32,i32,i32,i32,i32,i32,i32,i32')
        assertEq(c.unpack.kind, 'template')
        assertEq(formOp(c.unpack), 'unpack')
        assertEq(c.length.kind, 'template')
        assertEq(c.unit.kind, 'template')
        assertEq(c.emit.kind, 'shortWhenEnabled')
        assertEq(c.enabledTags.join(), b.enabledTags.join())
        assertEq(c.requiresAny, 'nan')
        assertEq(c.moduleName, 'fjs:ir/string/cpu')
        assertEq(c.version, '1')
        assertEq(c.longPath, 'fjs:l0')
    },
    // README empty constant and is_short_string.
    empty: () => {
        assertEq(EMPTY, 0x7FF0_0000_0000_0008n)
        assert(isShort(EMPTY))
        assertEq(assertOk(tagOf(EMPTY)), 'empty')
        assertEq(assertOk(unpack(EMPTY)).join(), '')
        assertEq(assertOk(length(EMPTY)), 0)
        assertEq(assertError(unit(EMPTY, 0)), 'oob')
        assertEq(assertError(unit(EMPTY, -1)), 'oob')
    },
    // Round-trip every scalar string tag the helpers encode.
    roundTrip: () => {
        /** @type {readonly (readonly [string, ShortTag])[]} */
        const cases = [
            ['', 'empty'],
            ['A', 's1x16'],
            ['\u0000', 's1x16'],
            ['\uffff', 's1x16'],
            ['ab', 's2x16'],
            ['\u0080\u0100', 's2x16'],
            ['xyz', 's3x16'],
            ['\u0000\u0080\uffff', 's3x16'],
            ['abcd', 's4x7'],
            ['hello', 's5x7'],
            ['abcdef', 's6x7'],
            ['abcdefg', 's7x7'],
            ['$0A_az12', 's8x6'],
            // alphabet edges for s8x6: $, digits, A–Z, _, a–z
            ['$9Z_azXY', 's8x6'],
        ]
        for (const [text, tag] of cases) {
            const units = unitsOf(text)
            const bits = assertOk(pack(units))
            assert(isShort(bits))
            assertEq(assertOk(tagOf(bits)), tag)
            assertEq(textOf(assertOk(unpack(bits))), text)
            assertEq(assertOk(length(bits)), units.length)
            if (units.length > 0) {
                assertEq(assertOk(unit(bits, 0)), atUnit(units, 0))
                assertEq(assertOk(unit(bits, units.length - 1)), atUnit(units, units.length - 1))
            }
            assertEq(assertError(unit(bits, units.length)), 'oob')
        }
        assertEq(allTags.join(), 'empty,s1x16,s2x16,s3x16,s4x7,s5x7,s6x7,s7x7,s8x6')
    },
    // Tag fit: too long, or units too wide for every tag of that length.
    forceLong: () => {
        assertEq(pack(unitsOf('abcdefghi'))[0], 'error')
        assertEq(pack(unitsOf('ab\u0080c'))[0], 'error')
        assertEq(pack([0x80, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67])[0], 'error')
        assertEq(pack([0x80, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66])[0], 'error')
        assertEq(pack([0x61, 0x62, 0x63, 0x64, 0x80])[0], 'error')
        assertEq(pack([0x61, 0x62, 0x63, 0x64, 0x65, 0x80])[0], 'error')
        // s8x6 rejects units outside the alphabet (space, @, backtick, DEL)
        assertEq(pack(unitsOf('abcd efg'))[0], 'error')
        assertEq(pack(unitsOf('abcd@efg'))[0], 'error')
        assertEq(pack(unitsOf('abcd`efg'))[0], 'error')
        assertEq(pack([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x7f])[0], 'error')
        assertEq(assertError(tagOf(0n)), 'not_short')
        assertEq(assertError(tagOf(0x7FF0_0000_0000_0038n)), 'not_short')
        // empty / low-byte tags with junk above the field → not_short (full mask)
        assert(isShort(0x7FF0_0000_0001_0008n))
        assertEq(assertError(tagOf(0x7FF0_0000_0001_0008n)), 'not_short')
        assertEq(assertError(unpack(0x7FF0_0000_0001_0008n)), 'not_short')
        assertEq(assertError(tagOf(0x7FF0_0000_0100_0018n)), 'not_short')
        assertEq(assertError(tagOf(0xFFF0_0000_0000_0028n)), 'not_short')
        assertEq(assertError(unpack(0x7FF0_0000_0000_0010n)), 'not_short')
        assertEq(assertError(length(0x7FF0_0000_0000_0002n)), 'not_short')
        assertEq(assertError(unit(0x7FF0_0000_0000_0020n, 0)), 'not_short')
        assert(!isShort(0x7FF0_0000_0000_0010n))
        assert(!isShort(0x7FF0_0000_0000_0002n))
        assert(!isShort(0n))
    },
    // Ambiguous low-4 patterns: s7x7 payload may set bit 3 (looks like 0xC).
    tagDispatch: () => {
        const s3 = assertOk(pack(unitsOf('abc')))
        const s7even = assertOk(pack(unitsOf('bbcdefg'))) // first unit even → low4 0x4
        const s7odd = assertOk(pack(unitsOf('abcdefg'))) // first unit odd → low4 0xC
        const s8 = assertOk(pack(unitsOf('$0A_az12')))
        assertEq(assertOk(tagOf(s3)), 's3x16')
        assertEq(assertOk(tagOf(s7even)), 's7x7')
        assertEq(assertOk(tagOf(s7odd)), 's7x7')
        assertEq(assertOk(tagOf(s8)), 's8x6')
        assertEq(s3 & 0xFn, 0x4n)
        assertEq(s7even & 0xFn, 0x4n)
        assertEq(s7odd & 0xFn, 0xCn)
        assertEq(s8 & 0xFn, 0xCn)
        assert((s7odd & 0x8000_0000_0000_0000n) !== 0n)
        assert((s8 & 0x8000_0000_0000_0000n) === 0n)
        assert((s3 & 0x8000_0000_0000_0000n) === 0n)
    },
    // S3: B IR module defines Any for unseal, exports length/unit, types clean.
    irModule: () => {
        assertEq(irModule.imports.map(([k]) => k).join(), 'Ref,String')
        assertEq(definedBy(irModule), 'Any')
        assertEq(irModule.exports.join(), 'length,unit')
        assertEq(assertOk(checkPlain(irModule)).functions.map(([k]) => k).join(),
            'isRef,dup,drop,kind,oob,unit2,unit3x16,unit4x7,unit5x7,unit6x7,unit7x7,unit8,length,unit')
        assertEq(assertOk(check(assertOk(lifetime(irModule)))).exports.join(), 'length,unit')
        assertEq(b.length.kind, 'template')
        assertEq(b.unit.kind, 'template')
    },
}
