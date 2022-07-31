/** @typedef {{readonly[k in string]: Definition}} Library */

/** @typedef {Struct|Interface} Definition */

/**
 * @typedef {{
 *  readonly interface?: undefined
 *  readonly struct: FieldArray
 * }} Struct
 */

/** @typedef {{readonly[k in string]: Type}} FieldArray */

/** @typedef {readonly[string, Type]} Field */

/**
 * @typedef {{
 *  readonly interface: MethodArray
 *  readonly guid: string
 * }} Interface
 */

/** @typedef {{readonly[k in string]: FieldArray}} MethodArray */

/** @typedef {BaseType|Id|Pointer} Type */

/** @typedef {readonly[string]} Id */

/**
 * @typedef {|
 *  'u8'|
 *  'i8'|
 *  'u16'|
 *  'i16'|
 *  'u32'|
 *  'i32'|
 *  'u64'|
 *  'i64'|
 *  'usize'|
 *  'isize'|
 *  'f32'|
 *  'f64'|
 *  'bool'
 * } BaseType
 */

/** @typedef {readonly['*', Type]} Pointer */

module.exports = {}
