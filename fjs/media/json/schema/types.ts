/**
 * Type-level API of the JSON Schema writer: the document type its `unknown`
 * schema renders to, and the pin that keeps that schema's hand-written
 * `Phantom` annotation honest.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Check, Ts } from '../../../rtti/ts/types.ts'
import type { _unknownThunk, unknown as schemaUnknown } from './module.f.mjs'

/**
 * A JSON Schema (draft 2020-12) document, as `./module.f.mjs`'s `unknown`
 * schema renders it: what `toJsonSchema` answers with, and what a caller
 * writes a schema of its own against.
 */
export type JsonSchema = Ts<typeof schemaUnknown>

// The hand-written `$out` on `unknown` matches the real thunk. Checked against
// the un-annotated `_unknownThunk`, so a wrong field there is caught instead
// of silently trusted through the annotation, which `Ts<>` short-circuits to.
//
// This was `./proof.f.mjs`'s `consistency` entry, a body of nothing but
// typedefs — so neither of its two pins bound to a statement and both were
// green whatever they claimed (`../../../AGENTS.md` §1.4). This directory had
// no `types.ts` to move them to, so it has one now, and `JsonSchema` names
// what the proof spelled out at six sites.
//
// Only one of the two comes along. The other checked `Ts<typeof unknown>`
// against `typeof unknown` — the wrapped export on both sides, which `Ts<>`
// short-circuits to the same annotation, so it was `Equal<X, X>` and passed
// whatever the annotation said. Measured: a wrong field in the annotation
// reports this line and not that one.
type _UnknownMatchesItsThunk = Assert<Check<JsonSchema, typeof _unknownThunk>>
