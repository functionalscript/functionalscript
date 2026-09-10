/**
 * Type-level API of the DataJS conformance corpus: the record a vector is,
 * one shape per set, and the host recipes a serializer-side input may
 * carry. The schema in prose, and where the sets live, is
 * `spec/datajs/vectors/README.md`; the sets themselves are DataJS data
 * modules, which carry no annotations, so a consumer types a set at the
 * import with these.
 *
 * @module
 */

import type { Primitive, Unknown } from '../types.ts'

/**
 * A document as a vector carries it: the text, as a JavaScript string
 * whose code units are the document's, or the bytes, for the two rules only
 * bytes can reach — a document is UTF-8, and it has no BOM.
 */
export type Document = string | readonly number[]

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
    readonly input: Input
    readonly graph: Unknown
}

/** An input a serializer must refuse, and the one rule it breaks. */
export type SerializerReject = Base & {
    readonly input: Input
    readonly rule: string
}

/** An input graph, documents that denote it, and documents that do not. */
export type GraphEquivalence = Base & {
    readonly input: Input
    readonly denotes: readonly string[]
    readonly denotesNot: readonly string[]
}

/** An input graph and the one document normalized form produces for it. */
export type Normalize = Base & {
    readonly input: Input
    readonly text: string
}

/**
 * A serializer-side input: a value of the data model, or one carrying a host
 * recipe where the corpus has to describe what no data literal can spell.
 * An object whose own `host` property names a recipe is that recipe; the
 * corpus reserves the key for it, so a plain object has none, and an object
 * with a `host` outside the vocabulary is refused by `tsc` rather than read
 * as data.
 */
export type Input =
    | Primitive
    | readonly Input[]
    | ({ readonly [k in string]?: Input } & { readonly host?: never })
    | Recipe

export type Recipe = Leaf | Modifier

/** A host value with no data to describe. */
export type Leaf = Fn | SymbolLeaf | Builtin | Hole

/** A function with no own properties: an arrow, its `name` and `length` deleted. */
export type Fn = { readonly host: 'fn' }

/** A fresh unique symbol, as a value. */
export type SymbolLeaf = { readonly host: 'symbol' }

/** A non-plain built-in object; `ms` is `date`'s time value. */
export type Builtin = {
    readonly host: 'builtin'
    readonly kind: 'date' | 'map' | 'regexp' | 'boxedNumber'
    readonly ms?: number
}

/** An array hole, legal only as an element of an array. */
export type Hole = { readonly host: 'hole' }

/**
 * A host variation of the data `on` describes — the same object, modified,
 * never a copy. A modifier is a `const` of its own in a set, and `on` names
 * an array, an object or another modifier: stacking is chaining, the inner
 * modifier applying first, and a node is the `on` of at most one modifier,
 * since the chain is the only order an exported value carries.
 */
export type Modifier =
    | OwnProp
    | NonEnumerable
    | Getter
    | Setter
    | SymbolKey
    | Proto
    | Attrs
    | Link

/** One more own enumerable data property on `on`. */
export type OwnProp = {
    readonly host: 'ownProp'
    readonly on: Input
    readonly key: string
    readonly value: Input
}

/** The same, non-enumerable. */
export type NonEnumerable = {
    readonly host: 'nonEnumerable'
    readonly on: Input
    readonly key: string
    readonly value: Input
}

/** An enumerable accessor whose getter records that it was invoked, then returns `value`. */
export type Getter = {
    readonly host: 'getter'
    readonly on: Input
    readonly key: string
    readonly value: Input
}

/** An enumerable accessor with a setter and no getter, which reads as `undefined`. */
export type Setter = {
    readonly host: 'setter'
    readonly on: Input
    readonly key: string
}

/** An enumerable own data property under a fresh unique symbol. */
export type SymbolKey = {
    readonly host: 'symbolKey'
    readonly on: Input
    readonly value: Input
}

/**
 * The same data under a `null` prototype, or as an `Array` subclass
 * instance; `inherited` puts one enumerable member on the subclass's
 * prototype, under a key that is not an own key of the target.
 */
export type Proto = {
    readonly host: 'proto'
    readonly on: Input
    readonly to: 'null' | 'arraySubclass'
    readonly inherited?: readonly [key: string, value: Input]
}

/**
 * The same data with those attributes; `key` is required with
 * `nonWritable`, forbidden otherwise, and names an existing own data
 * property of the target.
 */
export type Attrs = {
    readonly host: 'attrs'
    readonly on: Input
    readonly how: 'frozen' | 'sealed' | 'nonExtensible' | 'nonWritable'
    readonly key?: string
}

/**
 * The same data with one more element or enumerable own data property,
 * `key`, holding `to` — which may be `on` itself or a node above it: a
 * cycle, which a data literal cannot spell.
 */
export type Link = {
    readonly host: 'link'
    readonly on: Input
    readonly key: string | number
    readonly to: Input
}
