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
import { error, ok } from '../../types/result/module.f.mjs'

export const packageJsonSchema = /** @type {const} */ ({
    name: option(string),
    version: option(string),
    scripts: option(record(string)),
})

/** @typedef {Ts<typeof packageJsonSchema>} PackageJson */
/** @typedef {string | ValidationError} JsonTextError */

export const validatePackageJson = rttiValidate(packageJsonSchema)

/**
 * @param {string} text
 * @returns {Result<PackageJson, JsonTextError>}
 */
export const validatePackageJsonText = text => {
    const [t, v] = parseJsonText(text)
    if (t === 'error') { return error(v) }
    const [t2, v2] = validatePackageJson(v)
    return t2 === 'ok' ? ok(v2) : error(v2)
}
