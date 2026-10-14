/**
 * Type-level API for `fjs/media/module.f.mjs`: the `DialectEntry` registry
 * shape `detect` and `dialectEntry` share with every registered dialect, and
 * the `JsonDialect` kit `jsonDialect` derives for a `vnd.fjs.*`+json one.
 *
 * @module
 */

import type { Unknown, Ts } from '../rtti/ts/types.ts'
import type { Bigint, Struct } from '../rtti/types.ts'
import type { ValidationError } from '../rtti/common/types.ts'
import type { Result } from '../types/result/types.ts'
import type { Unknown as JsonUnknown } from './json/types.ts'
import type { Assert } from '../asserts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { jsonDialect } from './module.f.mjs'

/**
 * One registered dialect: the name it tags itself with, and a predicate
 * deciding whether an already-parsed value is one of its blobs.
 *
 * `match` takes rtti's `Unknown` — the encoding-neutral one, admitting
 * `bigint` and `undefined` — not `fjs/media/json`'s JSON-only `Unknown`, so an
 * entry stays usable by a future non-JSON detector over the same dialects.
 *
 * The type is deliberately not opaque: a caller may write the struct by hand.
 * The list is that caller's own declaration of what it wants recognized,
 * passed to its own `detect` call, so a fabricated entry mislabels only that
 * caller's results — there is no trust boundary between a caller and entries it
 * writes itself. The boundary that does exist, untrusted blob content, is on
 * the other side of `match`.
 */
export type DialectEntry = {
    readonly dialect: string
    readonly match: (_: Unknown) => boolean
}

/**
 * The value a dialect schema's container `S` denotes. `Ts<S>`, not
 * `Ts<Rest<S, Type>>`: for a non-tuple container the rest is discarded, so
 * both reduce to the same `ConstTs<S>`, and the short form spares inference
 * the expansion through rtti's recursive `Type`.
 */
type ValueOf<S extends Struct> = Ts<S>

/** The dialect tag a schema's container pins, as a literal. */
type DialectOf<S extends Struct> =
    ValueOf<S> extends { readonly dialect: infer D extends string } ? D : never

/**
 * Everything a JSON dialect derives from its schema's container `S` and the
 * error type `E` of its optional semantic refinement (`never` when it has
 * none). The dialect and its media type stay literals, and the value type is
 * the one the schema denotes, so a dialect module re-exporting the kit
 * publishes the same declarations it would writing them out.
 *
 * - `encodeText` serializes canonically, every object's property names
 *   sorted. It panics on a value holding a leaf JSON cannot spell — a
 *   `bigint`, `undefined`, a function, `NaN` or `±Infinity` — rather than
 *   answering with a plausible wrong text.
 * - `validate` checks the shape, then that every number has an exact JSON
 *   spelling (finite; `-0` included), then runs the refinement. Its output is
 *   a fixpoint: `decodeText(encodeText(v))` is `ok(v)` for every `v` it
 *   returns.
 * - `decodeText` parses JSON text, then validates it; a parse failure is a
 *   `string` error.
 * - `entry` registers the dialect for `detect`, matching exactly the values
 *   `validate` accepts.
 */
export type JsonDialect<S extends Struct, E = never> = {
    readonly dialect: DialectOf<S>
    readonly mediaType: `application/${DialectOf<S>}+json`
    readonly encodeText: (value: ValueOf<S>) => string
    readonly validate: (value: JsonUnknown) => Result<ValueOf<S>, ValidationError | E>
    readonly decodeText: (text: string) => Result<ValueOf<S>, ValidationError | E | string>
    readonly entry: DialectEntry
}

/**
 * `jsonDialect`'s schema parameter is `never` for a container whose value type
 * is not JSON, so a `bigint` member is refused at compile time; the runtime
 * check in the factory stays for what the type cannot see.
 */
type _NonJsonSchemaRefused = Assert<Equal<
    Parameters<typeof jsonDialect<{ readonly dialect: 'x', readonly n: Bigint }>>[0],
    never>>
