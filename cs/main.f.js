/** @typedef {{readonly [name in string]: Definition}} DefinitionArray */

/** @typedef {Struct|Interface|Namespace} Definition */

/**
 * @typedef {{readonly namespace: DefinitionArray}} Namespace
 */

/**
 * @typedef {{
 *  readonly attributes?: Attributes
 *  readonly struct: FieldArray
 * }} Struct
 */

/** @typedef {string} Attributes */

/** @typedef {readonly Field[]} FieldArray */

/** @typedef {readonly [string, Type]} Field */

/** @typedef {string|Pointer} Type */

/** @typedef {{ readonly '*': Type}} Pointer */

/**
 * @typedef {{
 *  readonly attributes: Attributes
 *  readonly interface: MethodArray
 * }} Interface
 */

/** @typedef {readonly Method[]} MethodArray */

/** @typedef {readonly[string, FieldArray, Type]} Method */

module.exports = {}
