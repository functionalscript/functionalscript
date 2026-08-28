/**
 * Type-level API for HTML serialization.
 */

import type { StringMap } from '../../types/object/types.ts'

type Tag = string

type Attributes = StringMap<string>

type Element1 = readonly [Tag, ...Node[]]

type Element2 = readonly [Tag, Attributes, ...Node[]]

/**
 * A FunctionalScript representation of an HTML element.
 *
 * - `[tag, ...children]` for elements without attributes.
 * - `[tag, attributes, ...children]` for elements with attributes.
 */
export type Element = Element1 | Element2

export type Node = Element | string
