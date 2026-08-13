/**
 * Helpers for reading package.json-style metadata without losing unrelated
 * fields before write-back.
 *
 * @module
 *
 * @import { ValidationError } from '../../types/rtti/common/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { parse as parseJsonText } from '../../media/json/module.f.mjs'
import { option, record, string } from '../../types/rtti/module.f.mjs'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.mjs'
import { okThen } from '../../types/result/module.f.mjs'

export const packageJsonSchema = /** @type {const} */ ({
    name: option(string),
    version: option(string),
    scripts: option(record(string)),
})

/** @typedef {Ts<typeof packageJsonSchema>} PackageJson */
/** @typedef {string | ValidationError} JsonTextError */

export const validatePackageJson = rttiValidate(packageJsonSchema)

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
