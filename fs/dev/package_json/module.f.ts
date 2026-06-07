/**
 * Helpers for reading package.json-style metadata without losing unrelated
 * fields before write-back.
 *
 * @module
 */
import type { Unknown } from '../../json/module.f.ts'
import { parse as jsonParse } from '../../json/parser/module.f.ts'
import { tokenize as jsonTokenize } from '../../json/tokenizer/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { option, record, string } from '../../types/rtti/module.f.ts'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.ts'
import type { ValidationError } from '../../types/rtti/validate/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'

export const packageJsonSchema = {
    name: option(string),
    version: option(string),
    scripts: option(record(string)),
} as const

export type PackageJson = Ts<typeof packageJsonSchema>
export type JsonTextError = string | ValidationError

export const validatePackageJson = rttiValidate(packageJsonSchema)

const parseJsonText = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

export const validatePackageJsonText = (text: string): Result<PackageJson, JsonTextError> => {
    const [t, v] = parseJsonText(text)
    if (t === 'error') { return error(v) }
    const [t2, v2] = validatePackageJson(v)
    return t2 === 'ok' ? ok(v2) : error(v2)
}
