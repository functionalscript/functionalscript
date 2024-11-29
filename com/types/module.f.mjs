import obj from '../../types/object/module.f.cjs'
import list from '../../types/list/module.f.cjs'
import f from '../../types/function/module.f.cjs'
const { compose } = f
const { filter } = list
const { entries } = Object

/** @typedef {{readonly[k in string]: Definition}} Library */

/** @typedef {Struct|Interface} Definition */

/**
 * @typedef {{
 *  readonly struct: FieldArray
 * }} Struct
 */

/** @typedef {{readonly[k in string]: Type}} FieldArray */

/** @typedef {obj.Entry<Type>} Field */

/**
 * @typedef {{
 *  readonly interface: MethodArray
 *  readonly guid: string
 * }} Interface
 */

/** @typedef {{readonly[k in string]: FieldArray}} MethodArray */

/** @typedef {obj.Entry<FieldArray>} Method */

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

/** @type {(kv: obj.Entry<Type>) => boolean} */
const isParam = ([name]) => name !== '_'

const filterParam = filter(isParam)

/** @type {(fa: FieldArray) => list.List<Field> } */
const paramList = compose(entries)(filterParam)

/** @type {<T>(v: T) => (f: (type: Type) => T) => (fa: FieldArray) => T} */
const result = v => f => fa => '_' in fa ? f(fa._) : v

export default {
    /** @readonly */
    paramList,
    /** @readonly */
    result,
}
