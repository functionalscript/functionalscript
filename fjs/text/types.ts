/**
 * Types for indented text blocks and UTF-8 bit vectors.
 *
 * @module
 */
import type { Vec } from '../types/bit_vec/types.ts'
import type { List } from '../types/list/types.ts'

type _ItemArray = readonly Item[]

type _ItemThunk = () => List<Item>

export type Block = _ItemThunk | _ItemArray

export type Item = string | _ItemArray | _ItemThunk

export type Utf8 = Vec
