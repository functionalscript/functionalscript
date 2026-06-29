/**
 * Indented text `Block` rendering and UTF-8 helpers: `flat` flattens a nested
 * block into prefixed lines, while `utf8`/`utf8ToString` convert between
 * strings and MSB-first UTF-8 bit vectors.
 *
 * @module
 */
import { msb, u8List, u8ListToVec, type Vec } from '../types/bit_vec/module.f.ts'
import type { Nullable } from '../types/nullable/module.f.ts'
import { flatMap, type List } from '../types/list/module.f.ts'
import { fromCodePointList, toCodePointList } from './utf8/module.f.ts'
import { stringToCodePointList, codePointListToString } from './utf16/module.f.ts'

export type Block = ItemThunk | ItemArray

type ItemArray = readonly Item[]

type ItemThunk = () => List<Item>

export type Item = string | ItemArray | ItemThunk

export const flat = (indent: string): (text: Block) => List<string> => {
    const f = (prefix: string) => {
        const g = (item: Item): List<string> =>
            typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return flatMap(g)
    }
    return f('')
}

const u8ListToVecMsb = u8ListToVec(msb)

export type Utf8 = Vec

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector.
 *
 * Boundary builder: returns `null` when the UTF-8 encoding would exceed
 * `maxLength` bits, so an oversized string is rejected uniformly on every JS
 * engine instead of overflowing the runtime's `bigint` cap (which throws on
 * `bun`). Every string is otherwise valid to UTF-8-encode, so `null` means
 * "too large" and nothing else. Callers that already bound the input length add
 * `!` (or `assert(v !== null)`).
 *
 * @param s The input string to be converted.
 * @returns The resulting UTF-8 bit vector (MSB first), or `null` when it would
 * exceed `maxLength` bits.
 */
export const utf8 = (s: string): Nullable<Utf8> =>
    u8ListToVecMsb(fromCodePointList(stringToCodePointList(s)))

/**
 * Converts a UTF-8 bit vector with MSB first encoding to a string.
 *
 * @param msbV - The UTF-8 bit vector with MSB first encoding.
 * @returns The resulting string.
 */
export const utf8ToString = (msbV: Utf8): string =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))
