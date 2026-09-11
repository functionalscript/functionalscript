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

One directory holds no vectors: `not-applicable/` carries the reasons the
matrix below needs, one record per class and role a role owes no vector
for.

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
two rules only bytes can reach — a document is UTF-8, and it has no BOM —
the bytes as a tagged hex string, `["hex", "ef bb bf …"]`, fed to the
reader's byte-accepting path. The spelling is one: lowercase pairs
separated by single spaces, at least one pair, which is how the issue's
byte tables read and what `bytes` in
[`fjs/media/datajs/vectors/module.f.mjs`](../../../fjs/media/datajs/vectors/module.f.mjs)
decodes, refusing any other. A byte-form vector is a record of the accept
or the reject set like any other, classed `byte/…`. A reject vector
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

**A serializer-side input** is a graph, or a graph carrying the one **host
recipe** the corpus needs: an object whose own `host` property is `"fn"` is a
function value, `() => 0`, and the key is reserved for it. A serializer's
callers are FunctionalScript, so what it can be handed is what
FunctionalScript can build — and the language has no mutation, no classes,
no `Object.defineProperty`, no `Object.assign`, no `Object.setPrototypeOf`,
no `Object.freeze`, no `Date` and no `RegExp`. An accessor, a non-enumerable
property, a symbol key, an array carrying an extra own property, a cycle, a
`null` prototype, an `Array` subclass and a frozen value therefore reach no
serializer, and the corpus describes none of them: a vector for an input no
caller can construct can never run. A function is the one value the language
has that the data model does not; a sparse-array hole and a symbol join it if
the subset spells them, and a `Map` when `Map` lands. The reservation reaches
inputs only, so an expected graph, which carries no recipes, may spell
`{"host":"fn"}` as the ordinary object it is.

**Normalized bytes** are the document as a string; a proof encodes it to
compare bytes, and every string the normalized serializer emits is a valid
document, so the accept grammar binds it.

## The class-by-role matrix

[`matrix.md`](./matrix.md) is generated from the sets by `npm run gen`, so
it is current or the build is red. Rows are the classes, columns the three
roles a conforming implementation may have — reader, serializer,
normalize, since conformance is per role and a serializer-only
implementation never runs a reader or a normalize vector. A cell is the
vector ids that role has for that class, the reason it owes none, or a
role whose sets have not landed.

**An empty cell with no reason fails the generator**, which is the whole
point of generating it: prose that mentions a class in two roles reads
exactly like prose that mentions it in three, and the issue this corpus
came from records five rounds where exactly that went unnoticed. The only
thing that answers an empty cell is a record in `not-applicable/` giving
the reason in words, reviewed beside the vectors like any other data. A
reason for a cell that has vectors, or for a class no vector carries, is a
failure too, so a reason cannot outlive the gap it was written for.

A role whose sets have not landed refuses nothing: a class cannot owe a
vector to a set that does not exist. Its column says so on every row, and
the refusal arrives with the set.

## What a vector may not do

- **Assert more than its role requires.** A reader vector owes the graph, a
  serializer vector any valid document denoting it, a normalize vector
  exact bytes; a spelling asserted anywhere but the last fails conforming
  implementations.
- **Be refusable for two reasons.** A reject vector is a whole document
  valid but for the one defect it names, and a serializer-reject input
  breaks one rule, placed so that a cheaper rule does not refuse it first: a
  malformed byte sequence sits inside an otherwise valid string, an
  offending value sits below the root.
- **Sample a range.** Both ends of every character class at every fixed
  position, the empty branch of every repetition, a signed twin for every
  number, a key twin for every string.
