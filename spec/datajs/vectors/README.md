# The DataJS conformance corpus

The machine-readable form of [the specification](../README.md)'s Conformance
section: the documents a reader accepts and rejects with the graphs they
denote, the inputs a serializer accepts, and the bytes a normalized
serializer produces. An implementation states which roles it
provides and is judged on the sets those roles own, with one inheritance:
normalized form is a conforming serializer before it is a normalized one, so
a normalized writer runs `serializer-accept` and `graph-equivalence` besides
`normalize`. This file is the schema and the rules
the sets are derived by; the sets are the data modules beside it, one directory
per set. The design issue that derived them has been deleted, its rules carried
here — the rounds that produced them are in this repository's history.

## The sets are DataJS modules

Each set is `<set>/data.f.mjs`, a FunctionalScript data module written in
the DataJS subset the specification describes: `const $n = …;` statements,
one `export default`, string keys, JSON's values and the leaves DataJS adds.
So the engine imports it today and the reader reads the same file as a
document: every set parses and denotes exactly the value the engine imports,
the sharing included. **That is a rule with teeth and it was broken:** every
set ended with a trailing comma before its `]`, which JavaScript takes and
DataJS refuses, so no set was readable by a conforming reader until it was
removed. It was found by measuring the files by hand, which is no
guarantee at all, so `npm run gen` now reads each source back, parses it with
the reader and compares the graph with the imported value — a set that stops
being DataJS is a red check, like a class that loses a role. The comparison is
the half worth having: the two can only disagree where both languages accept
the text and read it differently, a key order or a share spelled twice, which
is the one failure a corpus a harness *reads* rather than imports cannot
survive. A value two vectors share is one `const` — a
non-empty array or an object, never the empty array literal, which `tsc`
types as an evolving array when a `const` binds it and refuses every read
of. A set carries no
comments and no annotations, since the subset has neither; a consumer types
a set at the import, with the record types in
[`fjs/media/datajs/vectors/types.ts`](../../../fjs/media/datajs/vectors/types.ts).
A set ships a `proof.f.mjs` beside it, as every module does, proving the set's
shape — every vector named and classed with a non-empty string, the ids one of a
kind, the document and the graph present. Running a set against an
implementation is a second thing, and where it lives depends on the role: the
three writer-side sets are run from those same files, and the reader's two from
the reader's side, in `fjs/media/datajs/vectors/proof.f.mjs`. Below the matrix
says which run is where. A third-party implementation is closed by its own
harness, reading the same sets.

| set | directory | record | proved against |
| - | - | - | - |
| reader accept | `accept/` | `Accept` | the reader, from its own side |
| reader reject | `reject/` | `Reject` | the reader, from its own side |
| serializer accept | `serializer-accept/` | `SerializerAccept` | the serializer |
| graph equivalence | `graph-equivalence/` | `GraphEquivalence` | the serializer |
| normalize | `normalize/` | `Normalize` | the normalized serializer |

The writer has landed, so those three name an implementation that exists rather
than one to come, and every set is now run against it. The runs are in two
places, by which role they are about. **The reader's** are with the reader, in
[`fjs/media/datajs/vectors/proof.f.mjs`](../../../fjs/media/datajs/vectors/proof.f.mjs):
every accept document read to the graph its vector asserts, and every reject
document refused, with the layer each `rule` belongs to pinned before the
refusal.

**The writer's** are in each set's own proof, since what they check is the claim
the record makes. `serializer-accept` hands every input to the writer, and the
document that comes out must be one the reader takes, denoting the input: *a*
valid document and never a particular spelling, which is what this role owes.
`graph-equivalence` does the same over the sharing shapes, where `difference`
comparing containers as a bijection is what refuses an expanded share or a merge
of two distinct nodes — and it also checks the output against the vector's own
`denotesNot` list, the one check here that needs no reader at all. `normalize`
goes furthest and compares the output with the text, byte for byte, which is the
only role that may.

Reading a writer's output back through this repository's reader would agree with
itself if both were wrong in compensating ways. What keeps it from being
circular is that the reader is pinned by the accept set against graphs the
writer has no part in, and the `denotesNot` check sees the one family of wrong
outputs without consulting a reader.

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

The third, `byte-truncated`, is an ordinary reject record like the other two —
nothing in the set marks it otherwise, and nothing should, since a consumer
reads it the same way. What differs is how much a harness can conclude from it,
and that depends on the harness: at the document level it cannot fail, for the
reason the rule below gives, while a harness that can see where a refusal
happened does get an answer from it. This repository's reader proof is one, and
pins that those bytes do not decode.

A reject vector names the one `rule` it breaks and what the `host` does with
the same text, measured: a document JavaScript `accepts` is a narrowing
vector, the only kind that catches a reader delegating to the host; a
`syntaxError` or a `runtimeError` tests the corpus's own grammar.

**An expected graph** is a value of the data model, and sharing is part of
it: `[$a, $a]` with one `const` is one node reached twice, and `[[], []]`
is two nodes. **One shared node has no vector in any role**: an empty array,
which no set can bind — `const $e = [];` is an evolving `any[]` `tsc` refuses
every read of — so a writer that expands one shared empty array into two passes
the corpus. The limitation is
[an issue of its own](./todo/shared-empty-array.md); the empty object shares
normally. A proof compares the graph an implementation produced with
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
data model and the type is what says so, checked by `tsc` at the call.

The specification does state refusals — [§What may be serialized](../README.md#what-may-be-serialized)
names a function, a symbol, a `Date`, a hole, a symbol key, an accessor, a
non-enumerable property, an array with an extra own property and a cycle — and
**no vector can carry one**, because a set is a DataJS data module: DataJS has
no functions, no `Symbol`, no `Date`, and no way to spell a hole, an accessor or
a class. That is a property of the carrier rather than an omission, which is why
that section is a rule an implementation answers in its own tests, in whatever
host can build the value. One question is open on the other side of it: while
[this repository's writer](../../../fjs/media/datajs/todo/serializer.md) takes
`unknown` and refuses at run time rather than taking the data model and trusting
it, its parameter admits values the data model does not. That gap cannot become a
set here, and the reason is the same carrier fact: everything a set can spell is
a value of the data model, so what is outside the model is outside the corpus by
construction. It closes either by narrowing the parameter, after which the gap
has no inputs, or in that implementation's own tests — exactly as
§What may be serialized is answered. The decision is recorded in the writer's own
issue.

**Normalized bytes** are the document as a string, and the set's proof
compares that string against what the shipped writer emits rather than
encoding either to bytes, since two strings agreeing is the stronger claim
and code units are what the record can carry. Every string the normalized
serializer emits is a valid document, so the accept grammar binds it.

## The class-by-role matrix

[`matrix.md`](./matrix.md) is generated from the sets by `npm run gen`, so
it is current or the build is red. Rows are the classes, columns the three
roles a conforming implementation may have — reader, serializer,
normalize, since conformance is per role and a serializer-only
implementation never runs a reader or a normalize vector. A cell is the
vector ids that role has for that class, a reference to the note saying why
it owes none, or a role whose sets have not landed. A column is the sets
that role **owns**, not every set an implementation of it runs, so the
inheritance above does not fold in: a serializer vector asserts no spelling,
and letting one fill a `normalize` cell would report a class as covered
where nothing pins its bytes. That is not hypothetical — review found
`array/elements/negative-first` carrying a serializer vector and no
normalize one, and a column that inherited would have printed the first and
hidden the second. The notes are listed
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

## How a set is derived

A set is read off the specification, production by production, and never
assembled from interesting cases. That is not a preference: the design this
corpus came from records twenty-six consecutive review rounds that each found
one rule with no vector, and in every round the missing rule was one no author
would have thought of on their own. The rules below are what those rounds
turned into a derivation. Each is stated as an obligation, because each was
first met as a gap.

**Every production, and every branch of every production, owes an accept
vector.** A branch is the sign of a number present and absent, both `int`
alternatives, `frac` and `exp` present and absent, both `key` alternatives, an
empty and a non-empty container, a document with no `const` and one with
several. An interesting case covers a branch by accident; a derivation covers
every branch by construction.

**Both ends of every character class, at every fixed position it appears in.**
An interesting case reaches for the middle of a range — `12`, `1.5`, `a9` — and
a reader implementing `[1-9]` that forgets `9` is the ordinary way to get a
class wrong. *Fixed* is the whole of the obligation: `\uXXXX` has four
positions and owes every endpoint in each, since an implementation can unroll
four reads and get the third wrong, while `[0-9]*` has no fixed position and one
occurrence of each endpoint anywhere in the repetition discharges it. Demanding
more of a repetition would be a rule no set can satisfy.

`id`'s tail is the one production that earns more, and it earns exactly one
step more: each endpoint in a **one-character** tail — `$A`, `$Z`, `$a`, `$z`,
`$0`, `$9`, `$_`, `$$`, and `$` for the empty tail. The first tail character is
where an implementation naturally puts a distinct check — is there a suffix at
all, and may it repeat the prefix character — and nine vectors settle that,
where "every position of a repetition" is unbounded. The set it replaced covered
the same eight endpoints with `$AZ`, `$az`, `$09` and `$_$`, which satisfies the
repetition rule and still passes a reader whose first-tail state stops at `Z`,
`z`, `9` or a second `$`.

**Every repetition owes its empty branch.** The empty string, a one-character
identifier, a single-digit fraction, the empty array, the empty object, a
document with no `const`.

**A signed twin for every number and every bigint.** The sign is a prefix and a
reader may have a separate post-`-` state, so a set whose negatives all begin
with `1` passes a reader whose post-`-` state takes a leading `1` and nothing
else. Read the other way round it is the same rule: a vector added for a signed
value owes its unsigned twin. This one was missed five times, each time by a
commit that had just applied it elsewhere — `-0.0` and `-0e0` against the
literal `-0`, the four binary64 boundaries, `1.0`, and the bigint ceilings.

**A key twin for every string vector, in every role.**
`key ::= string | '[' '"__proto__"' ']'` puts the same `string` production in a
second syntactic position, and a shared production is not shared code: an
implementation with a correct value writer and a separate key writer emits
noncanonical escapes for object keys while passing every value vector above it.
The same concession settles `int` between `number` and `bigint` — a reader whose
bigint path accepts `[1][0-9]*` passes a corpus that only ever spells bigints
with a leading `1`.

**Every rule owes a vector in every direction it can be violated**, and there
are three: the reader's accept, the reader's reject, and each writer role.
Required whitespace once had `normalize` vectors only, which cannot catch a
reader accepting a document that omits the space; array holes once had a
serializer vector only, which cannot catch a reader accepting `[1,,2]` as
document text. A rule that *admits* something owes an accept vector for each
thing it admits, not only rejects for the neighbours it excludes: this corpus
rejected twenty-one kinds of whitespace before it accepted a document separated
by a tab, so a reader honouring only U+0020 passed the lot. **A new capability
owes its accept vectors in the commit that adds it** — the round that gave the
corpus a byte form gave it two byte rejects and no byte accept, and a reader
refusing every byte document would have passed.

A rule with one side gets its vector on that side, and naming the side is part
of the derivation. An elision is not a second rule a reader might reach: on the
reader's side it is what a hole *means*, since
`array ::= '[' (value (',' value)*)? ']'` cannot spell one, so `[1,,2]` is a
reject under the array production and a reader refusing it for the hole has
refused it for the elision under another name. That reject is the only vector a
hole gets. The data model's rule against a hole is the **serializer's**, in
§What may be serialized, and no vector can carry it for the reason the section
below gives — a set is a DataJS data module and cannot spell a hole to hand a
serializer — so that side is an obligation on an implementation's own tests
rather than a vector here.

**Across roles, a vector owes its counterparts wherever a plausible
implementation would differ.** Conformance is per role, so a reader-only
implementation runs no `normalize` vector and a serializer-only one runs no
reader vector: a `normalize` vector owes a reader vector wherever a plausible
implementation would read the same text as a different value, and a serializer
vector wherever one would emit a document denoting a different value. The
numbers that separate `0` from `-0`, the binary64 boundaries, and the bigints
past 2^53, 2^64 and 2^128 are that rule applied.

**A reject vector is derived from the specification's own narrowing rules and
from the grammars themselves** — every production, not only the prose. A
production states rejections no sentence states, and it is easy to skip
precisely because there is nothing to transcribe. Where DataJS is narrower than
JavaScript, a reject vector is the only instrument that sees it: the whole-set
subset law asks whether an accept document is valid JavaScript and never whether
something DataJS rejects would be accepted by the host.

**A narrowing vector's host classification is measured, not reasoned.** The
text is written to a module, imported, and what came back is what the record
says. `+1n` is the case that shows why: JavaScript *parses* it and throws only
at evaluation, so it is a `runtimeError` rather than a `syntaxError`, and a
reader that delegates its parse without evaluating over-accepts it. Reasoning
from the grammar would have classed it with `1.5n` and cost the vector its
point.

**Derive from the rule, not from a list.** §Whitespace accepts four characters
and rejects every other character JavaScript treats as whitespace or a line
terminator; the 21 the reject set enumerates come from that rule measured
against ECMAScript. A list written by hand was short by fifteen for as long as
one existed, and the specification now names only what it accepts. A stale rule
is a copied list whose source has moved, so a vector author reads the
specification as it currently reads — this file included.

**Measured, not assumed**, for everything a vector asserts: the graph a document
denotes, the host's verdict on a reject, `9007199254740993` read as
`9007199254740992`, `-1e-999` denoting `-0` where `1e-999` denotes `0`, U+2028
emitted literally because `QuoteJSONString` escapes only what is below U+0020
and the unpaired surrogates. A claim about how implementations are built is not
a substitute for a vector, and that substitution is what failed for `int`
between numbers and bigints, and for the whitespace class two rounds earlier.

## What this corpus cannot establish

Three limits, stated so a later round does not write vectors that cannot fail
or read a passing corpus as more than it is.

- **A shared empty array**, as the sharing rule above says: no set can bind one,
  so a writer that expands one shared empty array into two passes every role.
  [Its own issue](./todo/shared-empty-array.md) holds the search for a spelling
  and the schema change that was refused.
- **Arbitrary precision.** No finite set of vectors establishes it, because
  every value fits some wider fixed-width type. A vector past width *w* rules
  out a backend of width *w* and nothing more, so the bigint ceilings are chosen
  by the widths that exist in practice — 53 bits from a binary64, 64 from
  `i64`/`u64`, 128 from `i128`/`u128` — and stop there because there is no next
  standard width to defeat, not because three ceilings prove a negative. A
  backend bounded wider than 128 bits needs a vector of its own.
- **A serializer's refusals**, for the reason the record section gives: the
  inputs [§What may be serialized](../README.md#what-may-be-serialized) names
  cannot be spelled by a DataJS data module, so a serializer that answers one of
  them with a plausible wrong value passes this corpus. That rule is answered in
  an implementation's own tests, in a host that can build the value.

## What a vector may not do

- **Assert more than its role requires.** A reader vector owes the graph, a
  serializer vector any valid document denoting it, a normalize vector
  exact bytes; a spelling asserted anywhere but the last fails conforming
  implementations.
- **Be refusable for two reasons.** A reject vector is a whole document
  valid but for the one defect it names, placed so that a cheaper rule does
  not refuse it first.

  `byte-truncated` is the one stated exception. A truncated sequence must be
  the document's last byte to be truncated, so the document has lost its
  closing quote too, and a reader that replacement-decodes the lead byte
  refuses it as unterminated without checking UTF-8 at all. **A
  document-level harness therefore cannot fail it**, and should not count it
  as coverage of a decoder: it is kept because those bytes are not a DataJS
  document, which no code-unit string can say.

  A harness that can see *where* a refusal happened concludes more, and one
  exists: the reader proof in
  [`fjs/media/datajs/vectors/proof.f.mjs`](../../../fjs/media/datajs/vectors/proof.f.mjs)
  reads every reject vector's `rule` and asserts the layer — the UTF-8 rule is
  the decoder's and those bytes must decode to nothing, every other rule is the
  reader's on the text they spell. Under that check the vector does
  discriminate: a decoder that substitutes U+FFFD instead of refusing makes the
  bytes decode and fails it. Nothing in the record says which kind of harness is
  reading it, and nothing needs to — the record is an ordinary reject either
  way.

  The other two byte records are not exceptions at all. `byte-bom-first` has one
  defect and discriminates at the document level: its bytes are valid UTF-8 and
  the document is valid but for the BOM, so a reader that strips the BOM accepts
  it and fails the vector. `byte-valid-widths` is an accept.
- **Sample a range.** [How a set is derived](#how-a-set-is-derived) is the
  obligation and not a floor to sample from: both ends of every class at every
  fixed position, every repetition's empty branch, a signed twin, a key twin. A
  set that samples reads exactly like one that enumerates, which is how five
  rounds of review each found one more branch uncovered.
