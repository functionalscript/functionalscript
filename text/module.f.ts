import { msb, u8List, u8ListToVec, type Vec } from "../types/bit_vec/module.f.ts";
import { flatMap, type List } from '../types/list/module.f.ts'
import * as utf8 from './utf8/module.f.ts'
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

export const curly = (type: string) => (name: string) => (body: Block): Block =>
    [`${type} ${name}`, '{', body, '}']

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector.
 *
 * @param s The input string to be converted.
 * @returns The resulting UTF-8 bit vector, MSB first.
 */
export const msbUtf8 = (s: string): Vec =>
    u8ListToVec(msb)(utf8.fromCodePointList(stringToCodePointList(s)))

/**
 * Converts a UTF-8 bit vector with MSB first encoding to a string.
 *
 * @param msbV - The UTF-8 bit vector with MSB first encoding.
 * @returns The resulting string.
 */
export const msbUtf8ToString = (msbV: Vec): string =>
    codePointListToString(utf8.toCodePointList(u8List(msb)(msbV)))
