/**
 * The WebAssembly instruction set this repository reads and writes: every
 * instruction of the WebAssembly 2.0 core specification except the vector
 * (SIMD) ones, each with its opcode, its text-format mnemonic and the kind of
 * immediates that follow the opcode.
 *
 * **One table for the parser and both writers.** The binary parser reads an
 * opcode into a row, the binary writer a mnemonic back into its opcode, and the
 * WAT writer prints the mnemonic, so an instruction added here is added to all
 * three, and `../types.ts` derives the AST's instruction type from the same
 * rows.
 *
 * An opcode outside the table — SIMD's `0xfd` prefix, threads' `0xfe`, the
 * GC and exception-handling proposals — has no row, and the parser refuses it
 * rather than skipping what it cannot measure.
 *
 * `select` is the one mnemonic with two rows: `0x1b`, which takes its
 * operand type from the stack, and `0x1c`, which states it. An instruction
 * tells them apart by whether it carries the type list.
 *
 * @module
 *
 * @import { Encoding, Instruction, Kind, Mnemonic } from '../types.ts'
 */

/**
 * The single-byte opcodes, as `[opcode, mnemonic, kind]`.
 */
export const instructions = /** @type {const} */ ([
    [0x00, 'unreachable', 'none'],
    [0x01, 'nop', 'none'],
    [0x02, 'block', 'block'],
    [0x03, 'loop', 'block'],
    [0x04, 'if', 'block'],
    [0x05, 'else', 'none'],
    [0x0b, 'end', 'none'],
    [0x0c, 'br', 'index'],
    [0x0d, 'br_if', 'index'],
    [0x0e, 'br_table', 'brTable'],
    [0x0f, 'return', 'none'],
    [0x10, 'call', 'index'],
    [0x11, 'call_indirect', 'index2'],
    [0x1a, 'drop', 'none'],
    [0x1b, 'select', 'none'],
    [0x1c, 'select', 'select'],
    [0x20, 'local.get', 'index'],
    [0x21, 'local.set', 'index'],
    [0x22, 'local.tee', 'index'],
    [0x23, 'global.get', 'index'],
    [0x24, 'global.set', 'index'],
    [0x25, 'table.get', 'index'],
    [0x26, 'table.set', 'index'],
    [0x28, 'i32.load', 'memarg'],
    [0x29, 'i64.load', 'memarg'],
    [0x2a, 'f32.load', 'memarg'],
    [0x2b, 'f64.load', 'memarg'],
    [0x2c, 'i32.load8_s', 'memarg'],
    [0x2d, 'i32.load8_u', 'memarg'],
    [0x2e, 'i32.load16_s', 'memarg'],
    [0x2f, 'i32.load16_u', 'memarg'],
    [0x30, 'i64.load8_s', 'memarg'],
    [0x31, 'i64.load8_u', 'memarg'],
    [0x32, 'i64.load16_s', 'memarg'],
    [0x33, 'i64.load16_u', 'memarg'],
    [0x34, 'i64.load32_s', 'memarg'],
    [0x35, 'i64.load32_u', 'memarg'],
    [0x36, 'i32.store', 'memarg'],
    [0x37, 'i64.store', 'memarg'],
    [0x38, 'f32.store', 'memarg'],
    [0x39, 'f64.store', 'memarg'],
    [0x3a, 'i32.store8', 'memarg'],
    [0x3b, 'i32.store16', 'memarg'],
    [0x3c, 'i64.store8', 'memarg'],
    [0x3d, 'i64.store16', 'memarg'],
    [0x3e, 'i64.store32', 'memarg'],
    [0x3f, 'memory.size', 'index'],
    [0x40, 'memory.grow', 'index'],
    [0x41, 'i32.const', 'i32'],
    [0x42, 'i64.const', 'i64'],
    [0x43, 'f32.const', 'f32'],
    [0x44, 'f64.const', 'f64'],
    [0x45, 'i32.eqz', 'none'],
    [0x46, 'i32.eq', 'none'],
    [0x47, 'i32.ne', 'none'],
    [0x48, 'i32.lt_s', 'none'],
    [0x49, 'i32.lt_u', 'none'],
    [0x4a, 'i32.gt_s', 'none'],
    [0x4b, 'i32.gt_u', 'none'],
    [0x4c, 'i32.le_s', 'none'],
    [0x4d, 'i32.le_u', 'none'],
    [0x4e, 'i32.ge_s', 'none'],
    [0x4f, 'i32.ge_u', 'none'],
    [0x50, 'i64.eqz', 'none'],
    [0x51, 'i64.eq', 'none'],
    [0x52, 'i64.ne', 'none'],
    [0x53, 'i64.lt_s', 'none'],
    [0x54, 'i64.lt_u', 'none'],
    [0x55, 'i64.gt_s', 'none'],
    [0x56, 'i64.gt_u', 'none'],
    [0x57, 'i64.le_s', 'none'],
    [0x58, 'i64.le_u', 'none'],
    [0x59, 'i64.ge_s', 'none'],
    [0x5a, 'i64.ge_u', 'none'],
    [0x5b, 'f32.eq', 'none'],
    [0x5c, 'f32.ne', 'none'],
    [0x5d, 'f32.lt', 'none'],
    [0x5e, 'f32.gt', 'none'],
    [0x5f, 'f32.le', 'none'],
    [0x60, 'f32.ge', 'none'],
    [0x61, 'f64.eq', 'none'],
    [0x62, 'f64.ne', 'none'],
    [0x63, 'f64.lt', 'none'],
    [0x64, 'f64.gt', 'none'],
    [0x65, 'f64.le', 'none'],
    [0x66, 'f64.ge', 'none'],
    [0x67, 'i32.clz', 'none'],
    [0x68, 'i32.ctz', 'none'],
    [0x69, 'i32.popcnt', 'none'],
    [0x6a, 'i32.add', 'none'],
    [0x6b, 'i32.sub', 'none'],
    [0x6c, 'i32.mul', 'none'],
    [0x6d, 'i32.div_s', 'none'],
    [0x6e, 'i32.div_u', 'none'],
    [0x6f, 'i32.rem_s', 'none'],
    [0x70, 'i32.rem_u', 'none'],
    [0x71, 'i32.and', 'none'],
    [0x72, 'i32.or', 'none'],
    [0x73, 'i32.xor', 'none'],
    [0x74, 'i32.shl', 'none'],
    [0x75, 'i32.shr_s', 'none'],
    [0x76, 'i32.shr_u', 'none'],
    [0x77, 'i32.rotl', 'none'],
    [0x78, 'i32.rotr', 'none'],
    [0x79, 'i64.clz', 'none'],
    [0x7a, 'i64.ctz', 'none'],
    [0x7b, 'i64.popcnt', 'none'],
    [0x7c, 'i64.add', 'none'],
    [0x7d, 'i64.sub', 'none'],
    [0x7e, 'i64.mul', 'none'],
    [0x7f, 'i64.div_s', 'none'],
    [0x80, 'i64.div_u', 'none'],
    [0x81, 'i64.rem_s', 'none'],
    [0x82, 'i64.rem_u', 'none'],
    [0x83, 'i64.and', 'none'],
    [0x84, 'i64.or', 'none'],
    [0x85, 'i64.xor', 'none'],
    [0x86, 'i64.shl', 'none'],
    [0x87, 'i64.shr_s', 'none'],
    [0x88, 'i64.shr_u', 'none'],
    [0x89, 'i64.rotl', 'none'],
    [0x8a, 'i64.rotr', 'none'],
    [0x8b, 'f32.abs', 'none'],
    [0x8c, 'f32.neg', 'none'],
    [0x8d, 'f32.ceil', 'none'],
    [0x8e, 'f32.floor', 'none'],
    [0x8f, 'f32.trunc', 'none'],
    [0x90, 'f32.nearest', 'none'],
    [0x91, 'f32.sqrt', 'none'],
    [0x92, 'f32.add', 'none'],
    [0x93, 'f32.sub', 'none'],
    [0x94, 'f32.mul', 'none'],
    [0x95, 'f32.div', 'none'],
    [0x96, 'f32.min', 'none'],
    [0x97, 'f32.max', 'none'],
    [0x98, 'f32.copysign', 'none'],
    [0x99, 'f64.abs', 'none'],
    [0x9a, 'f64.neg', 'none'],
    [0x9b, 'f64.ceil', 'none'],
    [0x9c, 'f64.floor', 'none'],
    [0x9d, 'f64.trunc', 'none'],
    [0x9e, 'f64.nearest', 'none'],
    [0x9f, 'f64.sqrt', 'none'],
    [0xa0, 'f64.add', 'none'],
    [0xa1, 'f64.sub', 'none'],
    [0xa2, 'f64.mul', 'none'],
    [0xa3, 'f64.div', 'none'],
    [0xa4, 'f64.min', 'none'],
    [0xa5, 'f64.max', 'none'],
    [0xa6, 'f64.copysign', 'none'],
    [0xa7, 'i32.wrap_i64', 'none'],
    [0xa8, 'i32.trunc_f32_s', 'none'],
    [0xa9, 'i32.trunc_f32_u', 'none'],
    [0xaa, 'i32.trunc_f64_s', 'none'],
    [0xab, 'i32.trunc_f64_u', 'none'],
    [0xac, 'i64.extend_i32_s', 'none'],
    [0xad, 'i64.extend_i32_u', 'none'],
    [0xae, 'i64.trunc_f32_s', 'none'],
    [0xaf, 'i64.trunc_f32_u', 'none'],
    [0xb0, 'i64.trunc_f64_s', 'none'],
    [0xb1, 'i64.trunc_f64_u', 'none'],
    [0xb2, 'f32.convert_i32_s', 'none'],
    [0xb3, 'f32.convert_i32_u', 'none'],
    [0xb4, 'f32.convert_i64_s', 'none'],
    [0xb5, 'f32.convert_i64_u', 'none'],
    [0xb6, 'f32.demote_f64', 'none'],
    [0xb7, 'f64.convert_i32_s', 'none'],
    [0xb8, 'f64.convert_i32_u', 'none'],
    [0xb9, 'f64.convert_i64_s', 'none'],
    [0xba, 'f64.convert_i64_u', 'none'],
    [0xbb, 'f64.promote_f32', 'none'],
    [0xbc, 'i32.reinterpret_f32', 'none'],
    [0xbd, 'i64.reinterpret_f64', 'none'],
    [0xbe, 'f32.reinterpret_i32', 'none'],
    [0xbf, 'f64.reinterpret_i64', 'none'],
    [0xc0, 'i32.extend8_s', 'none'],
    [0xc1, 'i32.extend16_s', 'none'],
    [0xc2, 'i64.extend8_s', 'none'],
    [0xc3, 'i64.extend16_s', 'none'],
    [0xc4, 'i64.extend32_s', 'none'],
    [0xd0, 'ref.null', 'ref'],
    [0xd1, 'ref.is_null', 'none'],
    [0xd2, 'ref.func', 'index'],
])

/**
 * The opcodes after the `0xfc` prefix, as `[opcode, mnemonic, kind]`: the
 * saturating truncations and the bulk memory and table instructions. The
 * opcode is a `u32` after the prefix byte, not a byte.
 */
export const prefixed = /** @type {const} */ ([
    [0x00, 'i32.trunc_sat_f32_s', 'none'],
    [0x01, 'i32.trunc_sat_f32_u', 'none'],
    [0x02, 'i32.trunc_sat_f64_s', 'none'],
    [0x03, 'i32.trunc_sat_f64_u', 'none'],
    [0x04, 'i64.trunc_sat_f32_s', 'none'],
    [0x05, 'i64.trunc_sat_f32_u', 'none'],
    [0x06, 'i64.trunc_sat_f64_s', 'none'],
    [0x07, 'i64.trunc_sat_f64_u', 'none'],
    [0x08, 'memory.init', 'index2'],
    [0x09, 'data.drop', 'index'],
    [0x0a, 'memory.copy', 'index2'],
    [0x0b, 'memory.fill', 'index'],
    [0x0c, 'table.init', 'index2'],
    [0x0d, 'elem.drop', 'index'],
    [0x0e, 'table.copy', 'index2'],
    [0x0f, 'table.grow', 'index'],
    [0x10, 'table.size', 'index'],
    [0x11, 'table.fill', 'index'],
])

/** The byte that introduces a {@link prefixed} opcode. */
export const prefix = 0xfc

/**
 * The rows indexed by opcode, `undefined` where the table has none.
 *
 * @type {(rows: readonly (readonly [number, Mnemonic, Kind])[]) => readonly ((readonly [number, Mnemonic, Kind]) | undefined)[]}
 */
const byCode = rows => Array.from(
    { length: Math.max(...rows.map(([code]) => code)) + 1 },
    (_, code) => rows.find(row => row[0] === code))

/** {@link instructions}, indexed by opcode. */
export const single = byCode(instructions)

/** {@link prefixed}, indexed by the opcode after the prefix. */
export const afterPrefix = byCode(prefixed)

/** @type {Readonly<Record<string, Encoding>>} */
const byMnemonic = Object.fromEntries([
    ...instructions.map(([code, mnemonic, kind]) => [mnemonic, [[code], kind]]),
    ...prefixed.map(([code, mnemonic, kind]) => [mnemonic, [[prefix, code], kind]]),
    // `0x1b`, the row the typed `select` would otherwise replace.
    ['select', [[0x1b], 'none']],
])

/** The `0x1c` row of `select`, which states its operand types. */
const typedSelect = /** @type {Encoding} */ ([[0x1c], 'select'])

/**
 * The opcode bytes and immediate kind `instruction` is written with.
 *
 * @type {(instruction: Instruction) => Encoding}
 */
export const encoding = instruction =>
    instruction[0] === 'select' && instruction.length === 2
        ? typedSelect
        : byMnemonic[instruction[0]]
