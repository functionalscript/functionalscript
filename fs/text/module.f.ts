import { msb, u8List, u8ListToVec, type Vec } from '../types/bit_vec/module.f.ts'
import { flatMap, type List } from '../types/list/module.f.ts'
import type { Nominal } from '../types/nominal/module.f.ts'
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

/**
 * UTF-8 encoded byte sequence as an MSB-first bit vector.
 *
 * A `Utf8` is structurally a `Vec` and is assignable to `Vec`, but a plain
 * `Vec` is not assignable to `Utf8`. Use {@link utf8} to construct a `Utf8`
 * from a string, or {@link asUtf8} to assert that an existing `Vec` is a
 * valid UTF-8 byte sequence.
 */
export type Utf8 = Vec & Nominal<
    'utf8',
    '4b6a4b9b7a2c4f8c8e3d7e2a1c5b9d8f3e7a2c4b6d8f1e3a5c7b9d1f3e5a7c9b',
    Vec>

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector.
 *
 * @param s The input string to be converted.
 * @returns The resulting UTF-8 bit vector, MSB first.
 */
export const utf8 = (s: string): Utf8 =>
    u8ListToVecMsb(fromCodePointList(stringToCodePointList(s))) as Utf8

/**
 * Asserts that a `Vec` is a valid UTF-8 byte sequence.
 *
 * No validation is performed; this is the responsibility of the caller.
 */
export const asUtf8 = (v: Vec): Utf8 => v as Utf8

/**
 * Converts a UTF-8 bit vector with MSB first encoding to a string.
 *
 * @param msbV - The UTF-8 bit vector with MSB first encoding.
 * @returns The resulting string.
 */
export const utf8ToString = (msbV: Utf8): string =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))
