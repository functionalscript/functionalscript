/**
 * Type-level API of the DataJS reader: the node the fold builds per value,
 * and the output alphabet its mappings return into — the input alphabet is
 * `../../../ebnf/utf16/types.ts`.
 *
 * @module
 */

import type { Primitive } from '../types.ts'
import type { Text } from '../../json/parser/types.ts'

/**
 * A value as the fold builds it, before names are resolved: a primitive is
 * itself, a container holds its items in the order written, a reference
 * names a `const`, and a rejection stands where a value the format refuses
 * was written. A primitive is never an array, which is what tells it from
 * the tagged forms.
 */
export type Node = Primitive | Ref | Container | Rejected

/** A reference, by the name it spells: `$0`. */
export type Ref = readonly ['ref', string]

/** An array of its items, or an object of its members, each in the order written. */
export type Container =
    | readonly ['array', readonly Node[]]
    | readonly ['object', readonly Entry[]]

/** One member of an object: its decoded key and its value. */
export type Entry = readonly [key: string, value: Node]

/** What the format refuses, by message, standing in the value's place. */
export type Rejected = readonly ['error', string]

/** What a value's mapping returns: the node it built. */
export type Value = { readonly id: 'value', readonly node: Node }

/** The output alphabet: what the mappings return. */
export type Out = Text | Value
