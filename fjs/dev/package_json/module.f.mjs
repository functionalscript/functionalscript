/**
 * Helpers for reading package.json-style metadata without losing unrelated
 * fields before write-back.
 *
 * @module
 *
 * @import { ValidationError } from '../../types/rtti/common/types.ts'
 * @import { Ts, Unknown } from '../../types/rtti/ts/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { parse as parseJsonText } from '../../media/json/module.f.mjs'
import { option, record, string } from '../../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.mjs'
import { mapOk, okThen } from '../../types/result/module.f.mjs'

export const packageJsonSchema = /** @type {const} */ ({
    name: option(string),
    version: option(string),
    scripts: option(record(string)),
})

/** @typedef {Ts<typeof packageJsonSchema>} PackageJson */
/** @typedef {string | ValidationError} JsonTextError */

const parseShape = rttiParse(packageJsonSchema)

/**
 * Checks `value` against {@link packageJsonSchema} and returns **the value it
 * was given**, not a reconstruction of it.
 *
 * This module reads metadata without losing the unrelated fields a real
 * `package.json` carries, so those fields have to survive the check —
 * `dependencies`, `license`, and everything else the schema does not name.
 * `rttiParse` builds a fresh value holding only the declared members, which is
 * the right default everywhere else; here its result is used as the check and
 * discarded.
 *
 * The cast is what the successful parse just proved: `value` satisfies the
 * schema, and an open struct's type is satisfied by a value carrying more.
 *
 * This is the only place in the tree that still needs "check the shape, return
 * the original", and the module has no consumers — see
 * [todo/remove-module.md](./todo/remove-module.md).
 *
 * @type {(value: Unknown) => Result<PackageJson, ValidationError>}
 */
export const validatePackageJson = value =>
    mapOk(() => /** @type {PackageJson} */ (value))(parseShape(value))

/**
 * Parses `text` as JSON and validates it against {@link packageJsonSchema}.
 *
 * Both failures reach the caller as they were raised: a parse failure is a
 * `string`, a schema failure a `ValidationError`, and `JsonTextError` is
 * exactly that union — which is what `okThen` produces from the two steps'
 * own error types, with no rewrapping to widen either one.
 *
 * @param {string} text
 * @returns {Result<PackageJson, JsonTextError>}
 */
export const validatePackageJsonText = text =>
    okThen(validatePackageJson)(parseJsonText(text))
