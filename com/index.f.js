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

/** @typedef {null|string|Pointer} Type */

/** @typedef {readonly['*', Type]} Pointer */

module.exports = {}
