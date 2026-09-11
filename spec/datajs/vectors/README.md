# The DataJS conformance corpus

The machine-readable form of [the specification](../README.md)'s Conformance
section: the documents a reader accepts and rejects with the graphs they
denote, the inputs a serializer accepts, and the bytes a normalized
serializer produces. An implementation states which roles it
provides and is judged on those sets alone. This file is the schema; the
sets are the data modules beside it, one directory per set, and the issue
that designed them is [`../todo/conformance-vectors.md`](../todo/conformance-vectors.md).

## The sets are DataJS modules

Each set is `<set>/data.f.mjs`, a FunctionalScript data module written in
the DataJS subset the specification describes: `const $n = …;` statements,
one `export default`, string keys, JSON's values and the leaves DataJS adds.
So the engine imports it today and the reader reads the same file as a
document — measured, every set parses and denotes exactly the value the
engine imports, the sharing included. **That is a rule with teeth and it was
broken:** every set ended with a trailing comma before its `]`, which
JavaScript takes and DataJS refuses, so no set was readable by a conforming
reader until it was removed. A value two vectors share is one `const` — a
non-empty array or an object, never the empty array literal, which `tsc`
types as an evolving array when a `const` binds it and refuses every read
of. A set carries no
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
| graph equivalence | `graph-equivalence/` | `GraphEquivalence` | the serializer, when it lands |
| normalize | `normalize/` | `Normalize` | the normalized serializer, when it lands |

One directory holds no vectors: `not-applicable/` carries the reasons the
matrix below needs. A record answers a **scope** rather than a single cell —
one class, a subtree of them, or every class no set but one carries — so the
several hundred cells a role owes nothing to are answered by a few dozen
records. The rules that keep a wide scope honest are below, under the matrix.

The export of a set is an array of records. Every record carries an `id`, a
stable name a matrix or a failure can cite, and a `class`, the branch of the
specification the vector covers. A class is as fine as the thing an
implementation can get wrong on its own — one per emitting branch,
production alternative, or class endpoint with its own code path — because
the class-by-role matrix generated from the corpus is what shows a branch
short a role, and a row named for a topic shows a filled cell where a
branch under it is empty.

## What a record says

**A document** is a string whose code units are the document's. DataJS works
with correct UTF-8 and rejects everything else, so the format owes malformed
input no taxonomy and the corpus carries no vectors for one.

Three records carry bytes instead of code units, as a tagged hex string,
`["hex", "ef bb bf …"]` — lowercase pairs separated by single spaces, at
least one pair, which `bytes` in
[`fjs/media/datajs/vectors/module.f.mjs`](../../../fjs/media/datajs/vectors/module.f.mjs)
decodes, refusing any other spelling. All three are classed `byte/…`, and a
consumer that reads the byte form reads all three. Two of them are tests like
any other. `byte-bom-first` puts a BOM before an otherwise valid document, and
a reader that strips the BOM accepts it, which is the defect the vector exists
to catch. `byte-valid-widths`, in the accept set, spells one character of each
UTF-8 width and a reader owes the string those bytes denote; without it a byte
path passes by refusing every byte sequence handed to it.

The third, `byte-truncated`, is a **record rather than a test**: it says that a
byte sequence is not a DataJS document, which no code-unit string can say, and
no reader can fail it. The rule below says why.

A reject vector names the one `rule` it breaks and what the `host` does with
the same text, measured: a document JavaScript `accepts` is a narrowing
vector, the only kind that catches a reader delegating to the host; a
`syntaxError` or a `runtimeError` tests the corpus's own grammar.

**An expected graph** is a value of the data model, and sharing is part of
it: `[$a, $a]` with one `const` is one node reached twice, and `[[], []]`
is two nodes. A proof compares the graph an implementation produced with
`difference` in
[`fjs/media/datajs/vectors/module.f.mjs`](../../../fjs/media/datajs/vectors/module.f.mjs):
leaves by `Object.is`, so that `-0` and `0` differ and `NaN` is itself;
an array by `instanceof Array`, the spelling FunctionalScript uses; an
object by its members and nothing else, since no implementation written in
the subset can hand back a `Date`, a `Map` or a boxed number — there is no
way to build one — so the comparison does not look for what cannot arrive;
objects member by member in observable order; and containers as a
bijection, so a node the expected graph reaches twice must be one node in
the actual, and two nodes it keeps apart may not be merged. A duplicate key
is a document fact and never a graph fact: the document says
`{"a":1,"b":2,"a":3}` and the graph is `{"a":3,"b":2}`, last value in first
position.

**A serializer-side input** is an ordinary graph, spelled by the same literal
a reader-side expected graph is. There is no set of inputs a serializer
refuses, so the corpus describes none: a serializer is handed a value of the
data model and the type is what says so, checked by `tsc` at the call. Its
callers are FunctionalScript besides, which has no mutation, no classes, no
`Object.defineProperty`, no `Object.assign`, no `Object.setPrototypeOf`, no
`Object.freeze`, no `Date` and no `RegExp` — so an accessor, a non-enumerable
property, a symbol key, an array carrying an extra own property, a cycle, a
`null` prototype, an `Array` subclass and a frozen value reach no serializer
in any case. A vector for an input no caller can construct can never run.

**Normalized bytes** are the document as a string; a proof encodes it to
compare bytes, and every string the normalized serializer emits is a valid
document, so the accept grammar binds it.

## The class-by-role matrix

[`matrix.md`](./matrix.md) is generated from the sets by `npm run gen`, so
it is current or the build is red. Rows are the classes, columns the three
roles a conforming implementation may have — reader, serializer,
normalize, since conformance is per role and a serializer-only
implementation never runs a reader or a normalize vector. A cell is the
vector ids that role has for that class, a reference to the note saying why
it owes none, or a role whose sets have not landed. The notes are listed
once below the table, because one reason answers hundreds of cells and
printing it in each would be the same sentence several hundred times over —
unreadable, and past the bit vector's `maxLengthBytes` unwritable.

**An empty cell with no reason fails the generator**, which is the whole
point of generating it: prose that mentions a class in two roles reads
exactly like prose that mentions it in three, and the issue this corpus
came from records five rounds where exactly that went unnoticed. The only
thing that answers an empty cell is a record in `not-applicable/` giving
the reason in words, reviewed beside the vectors like any other data.

**A reason answers a scope, not always a cell**, because otherwise the bill
is unpayable: a role's column must answer every class in the corpus, and a
serializer owes nothing to the several hundred that are document facts — a
whitespace rule, a grammar production, a defect a reader refuses. So a
reason names one of three, tagged as a byte document is:

| scope | answers |
| - | - |
| `['class', 'number/exp/E']` | that one cell |
| `['subtree', 'id']` | every class under that prefix, by path segment |
| `['set', 'reject']` | every class no set but that one carries |

`set` is the widest and the most exact: a class only the reject set carries
is one no other role has a vector for, so a single reason is true of the
whole family by construction rather than by inspection. The most specific
reason wins, so a family's reason can be overridden for one class beneath it
without either being removed.

A wide scope is bought with a rule, and the rule is what keeps the table
honest: the generator refuses a reason the moment it answers a class that
**has** vectors for that role, so a reason cannot quietly stop being true of
something beneath it. It refuses one that answers no class at all, one
naming a set or a role the corpus does not have, a tag that is none of the
three, and two of equal specificity answering one cell. A reason cannot
outlive the gap it was written for. A set name is one name across the whole
corpus for the same reason: a `set` scope is answered by comparing names, so
two roles holding a set of one name would leave it unable to say which.

A role whose sets have not landed refuses nothing: a class cannot owe a
vector to a set that does not exist. Its column says so on every row, and
the refusal arrives with the set.

## What a vector may not do

- **Assert more than its role requires.** A reader vector owes the graph, a
  serializer vector any valid document denoting it, a normalize vector
  exact bytes; a spelling asserted anywhere but the last fails conforming
  implementations.
- **Be refusable for two reasons.** A reject vector is a whole document
  valid but for the one defect it names, placed so that a cheaper rule does
  not refuse it first.

  `byte-truncated` is the one stated exception, and it is marked a record
  rather than a test for exactly this reason. A truncated sequence must be the
  document's last byte to be truncated, so the document has lost its closing
  quote too, and a reader that replacement-decodes the lead byte refuses it as
  unterminated without checking UTF-8 at all. That vector cannot fail. It is
  kept to say that those bytes are not a DataJS document, which no code-unit
  string can say, and it is not counted as coverage of a decoder.

  The other two byte records are not exceptions. `byte-bom-first` has one
  defect and discriminates: its bytes are valid UTF-8 and the document is
  valid but for the BOM, so a reader that strips the BOM accepts it and fails
  the vector. `byte-valid-widths` is an accept.
- **Sample a range.** Both ends of every character class at every fixed
  position, the empty branch of every repetition, a signed twin for every
  number, a key twin for every string.
