/**
 * The expected texts are `wasmprinter`'s (0.262.0) for the binary
 * [`binary/write`](../binary/write/module.f.mjs) writes of each module,
 * so each proof holds the two printers to the same text.
 *
 * @import { Module } from '../types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { emptyModule, everything } from '../testlib.f.js'
import { functions, wat } from './module.f.mjs'

/** `wasmprinter`'s text of `everything`. */
const everythingWat = [
    "(module $everything",
    "  (@custom \"first\" (before first) \"\\01\\02\\03\")",
    "  (type $unit (;0;) (func))",
    "  (type $\"#type1 \" (@name \"\") (;1;) (func (param i32 i64 f32 f64 funcref externref) (result i32 i64)))",
    "  (@custom \"second\" (after type) \"\")",
    "  (import \"env\" \"f\" (func $f (;0;) (type $unit)))",
    "  (import \"env\" \"t\" (table (;0;) 1 externref))",
    "  (import \"env\" \"m\" (memory (;0;) 1 65536))",
    "  (import \"env\" \"g\" (global $__stack_pointer (;0;) (mut f64)))",
    "  (table (;1;) 0 10 funcref)",
    "  (memory (;1;) 0)",
    "  (global (;1;) i32 i32.const 0)",
    "  (export \"f\" (func $\"na\\u{ef}ve \\u{2713}\"))",
    "  (export \"t\" (table 0))",
    "  (export \"m\" (memory 0))",
    "  (export \"g\" (global 1))",
    "  (start $\"na\\u{ef}ve \\u{2713}\")",
    "  (elem $\"#elem0 #x\" (@name \"#x\") (;0;) (i32.const 1) func $\"na\\u{ef}ve \\u{2713}\")",
    "  (elem (;1;) func $f $\"na\\u{ef}ve \\u{2713}\")",
    "  (elem (;2;) (table 1) (i32.const 0) func)",
    "  (elem (;3;) declare func $\"na\\u{ef}ve \\u{2713}\")",
    "  (elem (;4;) (i32.const 2) funcref (ref.func $f))",
    "  (elem (;5;) externref (ref.null extern))",
    "  (elem (;6;) (table 0) (i32.const 3) externref)",
    "  (elem (;7;) (table 1) (i32.const 4) funcref)",
    "  (elem (;8;) declare funcref (ref.func $\"na\\u{ef}ve \\u{2713}\"))",
    "  (func $\"na\\u{ef}ve \\u{2713}\" (;1;) (type $unit)",
    "    (local $x i32) (local $y i32) (local f64)",
    "    block ;; label = @1",
    "      loop (result i32) ;; label = @2",
    "        if (type $\"#type1 \") (param i32 i64 f32 f64 funcref externref) (result i32 i64) ;; label = @3",
    "          br 0 (;@3;)",
    "        else",
    "          br_table 0 (;@3;) 1 (;@2;) 2 (;@1;)",
    "        end",
    "      end",
    "    end",
    "    call $f",
    "    call_indirect (type $\"#type1 \")",
    "    select",
    "    select (result i32)",
    "    local.get $x",
    "    i32.load offset=4294967295",
    "    i32.const -2147483648",
    "    i32.const 2147483647",
    "    i64.const -9223372036854775808",
    "    i64.const 9223372036854775807",
    "    f32.const nan:0x400001 (;=NaN;)",
    "    f64.const nan:0x8000000000001 (;=NaN;)",
    "    ref.null extern",
    "    ref.func $\"na\\u{ef}ve \\u{2713}\"",
    "    memory.size",
    "    memory.init $.rodata",
    "    i32.trunc_sat_f64_u",
    "    table.copy 0 1",
    "    unreachable",
    "  )",
    "  (func (;2;) (type $\"#type1 \") (param $p i32) (param i64) (param $r f32) (param f64 funcref externref) (result i32 i64))",
    "  (data $.rodata (;0;) (i32.const 8) \"hi\")",
    "  (data (;1;) \"\")",
    "  (data $\"#data2 .rodata\" (@name \".rodata\") (;2;) (memory 1) (i32.const 0) \"\\ff\")",
    ")",
    "",
].join('\n')

/** Bits of floats: zeros, ones, infinities, NaNs, subnormals, extremes and decimals with and without exponents. */
const f32Bits = [0, 0x8000_0000, 0x3f80_0000, 0xbf80_0000, 0x7f80_0000, 0xff80_0000, 0x7fc0_0000, 0xffc0_0000, 0x0000_0001, 0x0040_0000, 0x0012_3456, 0x3dcc_cccd, 0x7f7f_ffff, 0x4b18_9680, 0x6c5a_f3e4]

const f64Bits = [0n, 0x8000_0000_0000_0000n, 0x3ff0_0000_0000_0000n, 0x3fb9_9999_9999_999an, 0x0000_0000_0000_0001n, 0x0008_0000_0000_0000n, 0x000f_ffff_ffff_ffffn, 0x7fef_ffff_ffff_ffffn, 0x4415_af1d_78b5_8c40n, 0x3e7a_d7f2_9abc_af48n, 0x7ff0_0000_0000_0000n, 0xfff8_0000_0000_0000n, 0x7ff0_0000_0000_0001n, 0x4059_0000_0000_0000n, 0xc000_0000_0000_0000n, 0x3ff8_0000_0000_0000n]

/**
 * What `everything` leaves out: branches to no label, a block of a type the
 * module lacks, an import of one, the immediates printed only where they are
 * not zero, alignments other than the natural one, an offset of more than
 * one instruction, and floats.
 *
 * @type {Module}
 */
const edges = {
    ...emptyModule,
    types: [{ params: ['i32'], results: [] }],
    imports: [{ module: 'm', name: 'f', desc: ['func', 7] }],
    data: [{ mode: ['active', 0, [['i32.const', 1], ['i32.const', 2], ['i32.add']]], bytes: [] }],
    functions: [
        { type: 0, locals: [], body: [['br', 0], ['br', 3], ['block', 0], ['block', 9], ['end'], ['end']] },
        {
            type: 7,
            locals: [[1, 'i64']],
            body: [
                ['i32.load8_u', { align: 1, offset: 0 }], ['i64.load16_s', { align: 0, offset: 2 }],
                ['i64.load32_u', { align: 2, offset: 0 }], ['i64.load', { align: 3, offset: 0 }],
                ['f32.store', { align: 0, offset: 0 }], ['i64.store8', { align: 0, offset: 0 }],
                ['memory.size', 1], ['memory.grow', 0], ['memory.fill', 2], ['memory.copy', 0, 0], ['memory.copy', 1, 0],
                ['memory.init', 3, 1], ['data.drop', 0], ['table.init', 1, 0], ['table.init', 0, 2], ['elem.drop', 1],
                ['table.copy', 0, 0], ['table.get', 0], ['table.size', 1], ['call_indirect', 0, 1],
                ['select', ['i32', 'f64']], ['select', []], ['ref.null', 'funcref'], ['ref.is_null'],
                ['global.get', 0], ['local.get', 1],
                ...f32Bits.map(b => /** @type {const} */ (['f32.const', b])),
                ...f64Bits.map(b => /** @type {const} */ (['f64.const', b])),
            ],
        },
    ],
}

/** `wasmprinter`'s text of `edges`. */
const edgesWat = [
    "(module",
    "  (type (;0;) (func (param i32)))",
    "  (import \"m\" \"f\" (func (;0;) (type 7)))",
    "  (func (;1;) (type 0) (param i32)",
    "    br 0",
    "    br 3 (; INVALID ;)",
    "    block (type 0) (param i32) ;; label = @1",
    "      block (type 9) ;; label = @2",
    "      end",
    "    end",
    "  )",
    "  (func (;2;) (type 7)",
    "    (local i64)",
    "    i32.load8_u align=2",
    "    i64.load16_s offset=2 align=1",
    "    i64.load32_u",
    "    i64.load",
    "    f32.store align=1",
    "    i64.store8",
    "    memory.size 1",
    "    memory.grow",
    "    memory.fill 2",
    "    memory.copy",
    "    memory.copy 1 0",
    "    memory.init 1 3",
    "    data.drop 0",
    "    table.init 1",
    "    table.init 2 0",
    "    elem.drop 1",
    "    table.copy",
    "    table.get 0",
    "    table.size 1",
    "    call_indirect 1 (type 0)",
    "    select (result i32 f64)",
    "    select (result)",
    "    ref.null func",
    "    ref.is_null",
    "    global.get 0",
    "    local.get 1",
    "    f32.const 0x0p+0 (;=0;)",
    "    f32.const -0x0p+0 (;=-0;)",
    "    f32.const 0x1p+0 (;=1;)",
    "    f32.const -0x1p+0 (;=-1;)",
    "    f32.const inf (;=inf;)",
    "    f32.const -inf (;=-inf;)",
    "    f32.const nan (;=NaN;)",
    "    f32.const -nan (;=NaN;)",
    "    f32.const 0x1.p-149 (;=0.000000000000000000000000000000000000000000001;)",
    "    f32.const 0x1.p-127 (;=0.000000000000000000000000000000000000005877472;)",
    "    f32.const 0x1.23456p-129 (;=0.000000000000000000000000000000000000001671814;)",
    "    f32.const 0x1.99999ap-4 (;=0.1;)",
    "    f32.const 0x1.fffffep+127 (;=340282350000000000000000000000000000000;)",
    "    f32.const 0x1.312dp+23 (;=10000000;)",
    "    f32.const 0x1.b5e7c8p+89 (;=1058790300000000000000000000;)",
    "    f64.const 0x0p+0 (;=0;)",
    "    f64.const -0x0p+0 (;=-0;)",
    "    f64.const 0x1p+0 (;=1;)",
    "    f64.const 0x1.999999999999ap-4 (;=0.1;)",
    "    f64.const 0x1.p-1074 (;=0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005;)",
    "    f64.const 0x1.p-1023 (;=0.000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011125369292536007;)",
    "    f64.const 0x1.ffffffffffffep-1023 (;=0.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002225073858507201;)",
    "    f64.const 0x1.fffffffffffffp+1023 (;=179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;)",
    "    f64.const 0x1.5af1d78b58c4p+66 (;=100000000000000000000;)",
    "    f64.const 0x1.ad7f29abcaf48p-24 (;=0.0000001;)",
    "    f64.const inf (;=inf;)",
    "    f64.const -nan (;=NaN;)",
    "    f64.const nan:0x1 (;=NaN;)",
    "    f64.const 0x1.9p+6 (;=100;)",
    "    f64.const -0x1p+1 (;=-2;)",
    "    f64.const 0x1.8p+0 (;=1.5;)",
    "  )",
    "  (data (;0;) (offset i32.const 1 i32.const 2 i32.add) \"\")",
    ")",
    "",
].join('\n')

export const proof = {
    empty: () => assertEq(wat(emptyModule), '(module)\n'),
    everything: () => assertEq(wat(everything), everythingWat),
    edges: () => assertEq(wat(edges), edgesWat),
    // Each function as it stands in the module's text.
    functions: () => {
        const texts = functions(everything)
        assertEq(texts.length, 2)
        texts.forEach(text => assertEq(everythingWat.includes(text), true))
        assertEq(texts[1], everythingWat.split('\n').at(-6) + '\n')
    },
    // An `end` or `else` with no block open, which no binary holds: at the
    // body's own indentation, as `wasmprinter` puts it.
    unbalanced: () => assertEq(
        functions({ ...emptyModule, types: [{ params: [], results: [] }], functions: [{ type: 0, locals: [], body: [['end'], ['else']] }] })[0],
        '  (func (;0;) (type 0)\n    end\n    else\n  )\n'),
}
