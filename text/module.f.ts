import { msb, u8List, u8ListToVec, type Vec } from "../types/bit_vec/module.f.ts";
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

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector.
 *
 * @param s The input string to be converted.
 * @returns The resulting UTF-8 bit vector, MSB first.
 */
export const utf8 = (s: string): Vec =>
    u8ListToVecMsb(fromCodePointList(stringToCodePointList(s)))

/**
 * Converts a UTF-8 bit vector with MSB first encoding to a string.
 *
 * @param msbV - The UTF-8 bit vector with MSB first encoding.
 * @returns The resulting string.
 */
export const utf8ToString = (msbV: Vec): string =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))
