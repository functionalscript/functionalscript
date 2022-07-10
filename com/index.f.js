/** @typedef {{readonly[k in string]: Definition}} Library */

/** @typedef {Struct|Interface} Definition */

/** @typedef {{readonly struct: FieldArray}} Struct */

/** @typedef {readonly Field[]} FieldArray */

/** @typedef {[string, Type]} Field */

/**
 * @typedef {{
 *  readonly interface: MethodArray
 *  readonly guid: string
 * }} Interface
 */

/** @typedef {readonly Method[]} MethodArray */

/** @typedef {readonly[string, FieldArray, Type]} Method */

/** @typedef {BaseType|Id|Pointer} Type */

/** @typedef {readonly[string]} Id */

/** @typedef {'u8'|'i8'|'u16'|'i16'|'u32'|'i32'|'u64'|'i64'|'usize'|'isize'|'bool'|''}  BaseType */

/** @typedef {{readonly '*': Type}} Pointer */

module.exports = {}
