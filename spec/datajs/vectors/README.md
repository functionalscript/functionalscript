# The DataJS conformance corpus

The machine-readable form of [the specification](../README.md)'s Conformance
section: the documents a reader accepts and rejects with the graphs they
denote, the inputs a serializer accepts and refuses, and the bytes a
normalized serializer produces. An implementation states which roles it
provides and is judged on those sets alone. This file is the schema; the
sets are the data modules beside it, one directory per set, and the issue
that designed them is [`../todo/conformance-vectors.md`](../todo/conformance-vectors.md).

## The sets are DataJS modules

Each set is `<set>/data.f.mjs`, a FunctionalScript data module written in
the DataJS subset the specification describes: `const $n = …;` statements,
one `export default`, string keys, JSON's values and the leaves DataJS adds.
So the engine imports it today, the DataJS reader will read it once it
exists, and a value two vectors share is one `const` — a non-empty array
or an object, never the empty array literal, which `tsc` types as an
evolving array when a `const` binds it and refuses every read of. A set carries no
comments and no annotations, since the subset has neither; a consumer types
a set at the import, with the record types in
[`fjs/media/datajs/vectors/types.ts`](../../../fjs/media/datajs/vectors/types.ts).
A set ships a `proof.f.mjs` beside it, as every module does, proving the
set's shape — every vector named and classed with a non-empty string, the
ids one of a kind, the document and the graph present — and the proof
that runs the set against an implementation lives with that
implementation.

| set | directory | record | proved against |
| - | - | - | - |
| reader accept | `accept/` | `Accept` | the reader, as the set lands |
| reader reject | `reject/` | `Reject` | the reader, as the set lands |
| serializer accept | `serializer-accept/` | `SerializerAccept` | the serializer, when it lands |
| serializer reject | `serializer-reject/` | `SerializerReject` | the serializer, when it lands |
| graph equivalence | `graph-equivalence/` | `GraphEquivalence` | the serializer, when it lands |
| normalize | `normalize/` | `Normalize` | the normalized serializer, when it lands |

The export of a set is an array of records. Every record carries an `id`, a
stable name a matrix or a failure can cite, and a `class`, the branch of the
specification the vector covers. A class is as fine as the thing an
implementation can get wrong on its own — one per emitting branch,
production alternative, or class endpoint with its own code path — because
the class-by-role matrix generated from the corpus is what shows a branch
short a role, and a row named for a topic shows a filled cell where a
branch under it is empty.

## What a record says

**A document** is a string whose code units are the document's, or, for the
two rules only bytes can reach — a document is UTF-8, and it has no BOM — an
array of bytes fed to the reader's byte-accepting path. A reject vector
names the one `rule` it breaks and what the `host` does with the same text,
measured: a document JavaScript `accepts` is a narrowing vector, the only
kind that catches a reader delegating to the host; a `syntaxError` or a
`runtimeError` tests the corpus's own grammar.

**An expected graph** is a value of the data model, and sharing is part of
it: `[$a, $a]` with one `const` is one node reached twice, and `[[], []]`
is two nodes. A proof compares the graph an implementation produced with
`difference` in
[`fjs/media/datajs/vectors/module.f.mjs`](../../../fjs/media/datajs/vectors/module.f.mjs):
leaves by `Object.is`, so that `-0` and `0` differ and `NaN` is itself;
an array by `Array.isArray`, the data model's boundary rather than the
prototype chain, so an array under a `null` prototype is an array; an
object as a plain one, under `Object.prototype` or `null`, the two a
reader may build it with, so a `Date`, a `Map` or a boxed number with no
members is not an empty object; objects member by member in observable
order; and containers as a
bijection, so a node the expected graph reaches twice must be one node in
the actual, and two nodes it keeps apart may not be merged. A duplicate key
is a document fact and never a graph fact: the document says
`{"a":1,"b":2,"a":3}` and the graph is `{"a":3,"b":2}`, last value in first
position.

**A serializer-side input** is a graph, or a graph carrying **host
recipes** where the corpus has to describe what no data literal can spell.
An object whose own `host` property names a recipe is that recipe, and the
key is reserved for it. Four leaves — `fn`, `symbol`, `builtin`, `hole` —
and eight modifiers — `ownProp`, `nonEnumerable`, `getter`, `setter`,
`symbolKey`, `proto`, `attrs`, `link` — each modifier naming the node it
applies to and denoting that node, modified, never a copy. A modifier's
target is an array, an object or a modifier over one, since nothing else
has properties to add or attributes to set, and `arraySubclass` narrows the
target to an array, the one shape whose prototype `inherited` reaches,
through a chain of modifiers as much as directly; a
`hole` is an array element and never an input of its own. A modifier is a
`const` of its own; stacking is chaining, a second modification naming the
first as its `on` and the inner one applying first, and a node is the `on`
of at most one modifier, since the chain is the only order an exported
value carries; `link` is how a cycle is spelled, since a `const` cannot
name itself. The vocabulary is closed: the types are the list, and they
carry the placement rules, so a recipe over a leaf, a hole outside an
array or an `inherited` member under a `null` prototype is refused by
`tsc` rather than left to a consumer; a plain input object may not have a
`host` key — the reservation reaches inputs only, and an expected graph,
which carries no recipes, may spell `{"host":"fn"}` as the ordinary object
it is. Their construction, and how the corpus proves them
against a FunctionalScript serializer, is the open decision the issue
records, since the repository's proof rules keep host-built values out of
proofs of FunctionalScript APIs.

**Normalized bytes** are the document as a string; a proof encodes it to
compare bytes, and every string the normalized serializer emits is a valid
document, so the accept grammar binds it.

## What a vector may not do

- **Assert more than its role requires.** A reader vector owes the graph, a
  serializer vector any valid document denoting it, a normalize vector
  exact bytes; a spelling asserted anywhere but the last fails conforming
  implementations.
- **Be refusable for two reasons.** A reject vector is a whole document
  valid but for the one defect it names, and a serializer-reject input
  breaks one rule, placed so that a cheaper rule does not refuse it first: a
  malformed byte sequence sits inside an otherwise valid string, an
  offending host value sits below the root.
- **Sample a range.** Both ends of every character class at every fixed
  position, the empty branch of every repetition, a signed twin for every
  number, a key twin for every string.
