/**
 * Type-level API for HTML serialization.
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'

type Tag = string

type Attributes = StringMap<string>

// The rest tail stays a plain `Node[]` rather than `readonly Node[]`: TypeScript
// (TS2456, "circularly references itself") cannot resolve this tuple's own
// mutually-recursive cycle (`Element1`/`Element2` -> `Node` -> `Element` ->
// `Element1`/`Element2`) through a `readonly` array rest element, only through
// a mutable one — verified against the pinned compiler. Approved exception to
// the repo-wide readonly rule (`fjs/AGENTS.md` §3.2) for that reason alone.

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
