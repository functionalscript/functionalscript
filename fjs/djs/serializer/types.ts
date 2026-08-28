/**
 * Type-level API for `fjs/djs/serializer/module.f.mjs`: the reference-count
 * map `countRefs` produces and `stringify` hoists `const`s from.
 *
 * @module
 */

import type { Unknown } from '../types.ts'

/** A value's `const` index and how many times the value is referenced. */
export type _RefCounter = readonly [number, number]

/** Every value of a graph, mapped to its {@link _RefCounter}. */
export type _Refs = ReadonlyMap<Unknown, _RefCounter>
