/**
 * Type-level API of the DataJS conformance corpus: the record a vector is,
 * one shape per set. Every input is a value of the data model, on both
 * sides: a serializer is handed one and its type is the contract, so there
 * is no set of inputs it refuses and nothing a vector has to describe that
 * a literal cannot spell. The schema in prose, and where the sets live, is
 * `spec/datajs/vectors/README.md`; the sets themselves are DataJS data
 * modules, which carry no annotations, so a consumer types a set at the
 * import with these.
 *
 * @module
 */

import type { Unknown } from '../types.ts'

/**
 * A document as a vector carries it: the text, as a JavaScript string
 * whose code units are the document's, or the bytes, for the two rules only
 * bytes can reach — a document is UTF-8, and it has no BOM — as a tagged
 * hex string, `['hex', 'ef bb bf …']`: lowercase pairs separated by single
 * spaces and nothing else, the spelling the issue's byte tables use, which
 * `bytes` in `module.f.mjs` decodes and refuses any other.
 */
export type Document = string | readonly ['hex', string]

/**
 * What every vector carries: a stable name, and the branch of the
 * specification it covers — one class per emitting branch, production
 * alternative or class endpoint that an implementation can get wrong on its
 * own, which is what the class-by-role matrix is built from.
 */
export type Base = {
    readonly id: string
    readonly class: string
}

/** A document a reader accepts, and the graph it denotes, sharing included. */
export type Accept = Base & {
    readonly document: Document
    readonly graph: Unknown
}

/**
 * What JavaScript itself does with a document DataJS rejects, measured: a
 * document the host accepts is a narrowing vector, the only kind that catches
 * a reader delegating to the host; one the host refuses tests the corpus's
 * own grammar.
 */
export type Host = 'accepts' | 'syntaxError' | 'runtimeError'

/** A document a reader rejects, the one rule it breaks, and what the host does with it. */
export type Reject = Base & {
    readonly document: Document
    readonly rule: string
    readonly host: Host
}

/** An input a serializer must not refuse, and the graph its output must denote. */
export type SerializerAccept = Base & {
    readonly input: Unknown
    readonly graph: Unknown
}

/** An input graph, documents that denote it, and documents that do not. */
export type GraphEquivalence = Base & {
    readonly input: Unknown
    readonly denotes: readonly string[]
    readonly denotesNot: readonly string[]
}

/** An input graph and the one document normalized form produces for it. */
export type Normalize = Base & {
    readonly input: Unknown
    readonly text: string
}
