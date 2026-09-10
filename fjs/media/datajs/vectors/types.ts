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
 * as data. A hole is not an input: it is an element, legal in an array
 * only, so `Arr` admits it where `Input` does not.
 */
export type Input =
    | Primitive
    | Arr
    | Obj
    | Fn
    | SymbolLeaf
    | Builtin
    | Modifier<Target>

/** An array as an input: inputs, or holes, which are legal nowhere else. */
export type Arr = readonly (Input | Hole)[]

/** A plain object as an input, with no `host` key, which is reserved for a recipe. */
export type Obj = { readonly [k in string]?: Input } & { readonly host?: never }

/**
 * What a modifier applies to: an array, an object, or a modifier over one,
 * since a modifier denotes its target. Nothing else has properties to add
 * or attributes to set, so a recipe over a leaf is refused by `tsc`.
 * `ArrayTarget` is the same over arrays alone, the target `arraySubclass`
 * narrows to, through a chain of modifiers as much as directly. Both spell
 * the modifier union in place rather than as `Modifier<Target>`, since a
 * recursive alias may recurse only through an interface, which is why the
 * modifier shapes are interfaces.
 */
export type Target =
    | Arr
    | Obj
    | OwnProp<Target>
    | NonEnumerable<Target>
    | Getter<Target>
    | Setter<Target>
    | SymbolKey<Target>
    | ProtoNull<Target>
    | ProtoArraySubclass
    | AttrsOfObject<Target>
    | AttrsOfProperty<Target>
    | Link<Target>

export type ArrayTarget =
    | Arr
    | OwnProp<ArrayTarget>
    | NonEnumerable<ArrayTarget>
    | Getter<ArrayTarget>
    | Setter<ArrayTarget>
    | SymbolKey<ArrayTarget>
    | ProtoNull<ArrayTarget>
    | ProtoArraySubclass
    | AttrsOfObject<ArrayTarget>
    | AttrsOfProperty<ArrayTarget>
    | Link<ArrayTarget>

export type Recipe = Leaf | Modifier<Target>

/** A host value with no data to describe. */
export type Leaf = Fn | SymbolLeaf | Builtin | Hole

/** A function with no own properties: an arrow, its `name` and `length` deleted. */
export type Fn = { readonly host: 'fn' }

/** A fresh unique symbol, as a value. */
export type SymbolLeaf = { readonly host: 'symbol' }

/** A non-plain built-in object: a `Date` at its time value `ms`, or one of the kinds that take no value. */
export type Builtin =
    | { readonly host: 'builtin', readonly kind: 'date', readonly ms: number }
    | { readonly host: 'builtin', readonly kind: 'map' | 'regexp' | 'boxedNumber', readonly ms?: never }

/** An array hole, an element of an `Arr` and never an `Input` of its own. */
export type Hole = { readonly host: 'hole' }

/**
 * A host variation of the data `on` describes — the same object, modified,
 * never a copy. A modifier is a `const` of its own in a set, and `on` names
 * an array, an object or another modifier: stacking is chaining, the inner
 * modifier applying first, and a node is the `on` of at most one modifier,
 * since the chain is the only order an exported value carries. `On` is
 * what the chain is over, a `Target` or an `ArrayTarget`.
 */
export type Modifier<On> =
    | OwnProp<On>
    | NonEnumerable<On>
    | Getter<On>
    | Setter<On>
    | SymbolKey<On>
    | Proto<On>
    | Attrs<On>
    | Link<On>

/** One more own enumerable data property on `on`. */
export interface OwnProp<On> {
    readonly host: 'ownProp'
    readonly on: On
    readonly key: string
    readonly value: Input
}

/** The same, non-enumerable. */
export interface NonEnumerable<On> {
    readonly host: 'nonEnumerable'
    readonly on: On
    readonly key: string
    readonly value: Input
}

/** An enumerable accessor whose getter records that it was invoked, then returns `value`. */
export interface Getter<On> {
    readonly host: 'getter'
    readonly on: On
    readonly key: string
    readonly value: Input
}

/** An enumerable accessor with a setter and no getter, which reads as `undefined`. */
export interface Setter<On> {
    readonly host: 'setter'
    readonly on: On
    readonly key: string
}

/** An enumerable own data property under a fresh unique symbol. */
export interface SymbolKey<On> {
    readonly host: 'symbolKey'
    readonly on: On
    readonly value: Input
}

/**
 * The same data under a `null` prototype, which has nothing to inherit
 * from, or an array as an `Array` subclass instance, where `inherited` puts
 * one enumerable member on the subclass's prototype, under a key that is
 * not an own key of the target. The array is an array through any chain
 * of modifiers over it, so `on` is an `ArrayTarget` whatever `On` is.
 */
export type Proto<On> = ProtoNull<On> | ProtoArraySubclass

export interface ProtoNull<On> {
    readonly host: 'proto'
    readonly on: On
    readonly to: 'null'
    readonly inherited?: never
}

export interface ProtoArraySubclass {
    readonly host: 'proto'
    readonly on: ArrayTarget
    readonly to: 'arraySubclass'
    readonly inherited?: readonly [key: string, value: Input]
}

/**
 * The same data with those attributes: the object frozen, sealed or made
 * non-extensible, or one existing own data property, `key`, made
 * non-writable.
 */
export type Attrs<On> = AttrsOfObject<On> | AttrsOfProperty<On>

export interface AttrsOfObject<On> {
    readonly host: 'attrs'
    readonly on: On
    readonly how: 'frozen' | 'sealed' | 'nonExtensible'
    readonly key?: never
}

export interface AttrsOfProperty<On> {
    readonly host: 'attrs'
    readonly on: On
    readonly how: 'nonWritable'
    readonly key: string
}

/**
 * The same data with one more element or enumerable own data property,
 * `key`, holding `to` — which may be `on` itself or a node above it: a
 * cycle, which a data literal cannot spell.
 */
export interface Link<On> {
    readonly host: 'link'
    readonly on: On
    readonly key: string | number
    readonly to: Input
}
