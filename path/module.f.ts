/**
 * Path parsing and normalization helpers for portable module paths.
 *
 * @module
 */
import type { Fold, Reduce, Unary } from "../types/function/operator/module.f.ts"
import { type List, fold, last, take, length, concat as listConcat, toArray } from '../types/list/module.f.ts'
import { join } from "../types/string/module.f.ts"
import { concat as stringConcat } from '../types/string/module.f.ts'

const foldNormalizeOp: Fold<string, List<string>>
= input => state => {
    switch(input) {
        case '': case '.': { return state }
        case '..': {
            switch(last(undefined)(state)) {
                case undefined:
                case '..': { return listConcat(state)([input]) }
            }
            return take(length(state) - 1)(state)
        }
        default: { return listConcat(state)([input]) }
    }
}

/**
 * Splits a path into normalized segments.
 *
 * Empty (`""`) and current-directory (`"."`) segments are removed, parent-directory
 * (`".."`) segments collapse the previous segment when possible, and Windows
 * separators are converted to POSIX separators.
 */
export const parse = (path: string): readonly string[] => {
    const split = path.replaceAll('\\', '/').split('/')
    return toArray(fold(foldNormalizeOp)([])(split))
}

/**
 * Normalizes a path string by parsing and rejoining it with POSIX separators.
 */
export const normalize: Unary<string, string>
= path => {
    const foldResult = parse(path)
    return join('/')(foldResult)
}

/**
 * Concatenates two path fragments and returns a normalized path.
 */
export const concat: Reduce<string>
= a => b => {
    const s = stringConcat([a, '/', b])
    return normalize(s)
}
