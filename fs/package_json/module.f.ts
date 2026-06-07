/**
 * Helpers for reading package.json-style metadata without losing unrelated
 * fields before write-back.
 *
 * @module
 */
import type { Unknown } from '../json/module.f.ts'
import { parse as jsonParse } from '../json/parser/module.f.ts'
import { tokenize as jsonTokenize } from '../json/tokenizer/module.f.ts'
import { stringToList } from '../text/utf16/module.f.ts'
import { option, record, string, unknown as rttiUnknown } from '../types/rtti/module.f.ts'
import { parse as rttiParse } from '../types/rtti/parse/module.f.ts'
import { validate as rttiValidate } from '../types/rtti/validate/module.f.ts'
import type { ValidationError } from '../types/rtti/validate/module.f.ts'
import type { Ts } from '../types/rtti/ts/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'

export const packageJsonSchema = {
    name: option(string),
    version: option(string),
    scripts: option(record(string)),
} as const

export const packageJsonWithVersionSchema = {
    version: string,
} as const

export const jsonObjectSchema = record(rttiUnknown)

export type PackageJson = Ts<typeof packageJsonSchema>
export type PackageJsonWithVersion = Ts<typeof packageJsonWithVersionSchema>
export type JsonObject = Ts<typeof jsonObjectSchema>
export type JsonTextError = string | ValidationError

export const parsePackageJson = rttiParse(packageJsonSchema)
export const validatePackageJson = rttiValidate(packageJsonSchema)
export const validatePackageJsonWithVersion = rttiValidate(packageJsonWithVersionSchema)
export const validateJsonObject = rttiValidate(jsonObjectSchema)

export const parseJsonText = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

export const parsePackageJsonText = (text: string): Result<PackageJson, JsonTextError> => {
    const result = parseJsonText(text)
    if (result[0] === 'error') { return error(result[1]) }
    const metadata = parsePackageJson(result[1])
    return metadata[0] === 'ok' ? ok(metadata[1]) : error(metadata[1])
}

export const validateJsonObjectText = (text: string): Result<JsonObject, JsonTextError> => {
    const result = parseJsonText(text)
    if (result[0] === 'error') { return error(result[1]) }
    const object = validateJsonObject(result[1])
    return object[0] === 'ok' ? ok(object[1]) : error(object[1])
}
