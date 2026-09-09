## DataJS parser and serializer

**Priority:** P1 — stage 4 is P1 in the coordinating issue and in the
conformance-vector issue, which says outright that it blocks stage 4 "which is
P1". This file is the canonical co-located issue, so it carries the same level.
**Status:** wip — **the reader landed, on the grammar route.**
[`fjs/media/datajs/parser`](../parser/module.f.mjs) folds the grammar of
[`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs) to a node per
value as [`fjs/ebnf/ll1`](../../../ebnf/ll1/README.md) parses it, and
resolves the names over the statements in document order; `parse(text)`
returns `Result<Unknown, string>`. §3's open question is settled: the token-driven
container machine is retired for this format, not widened, and the seam
work that route owed is gone with it. What remains is the **byte path**
(`tryParseBytes`, §Layout), the **serializer** (§4) and **normalized form**
(§5), and the reader's proofs over the corpus once
[stage 1b](../../../../spec/datajs/todo/conformance-vectors.md) lands — the
reader's own proof is derived from the specification by hand today.

### Problem

`fjs/media/datajs` holds a reader and no writer. It is stage 4 of
[`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md)
and the deliverable EDAG is waiting for: a reader and a writer for the format
[`spec/datajs/README.md`](../../../../spec/datajs/README.md) specifies.

The spec is finished and normative. **This issue implements it and does not
redesign it.** Where the two disagree the spec wins, and a disagreement is a bug
in this file.

Three things make it more than "JSON plus four leaves", and each is a section
below:

- a document is a **module**, not a value — `const` statements, then one
  `export default`, with names and a declare-before-use rule;
- a document denotes a **DAG**, so a reference must read back as the same node,
  and a serializer must hoist a node reachable more than once;
- the reader is the grammar mapped straight to values, so what it reuses of
  JSON's reader is its `string` mapping and nothing of the token machine
  that reader retired — §3 records the decision.

### Proposal

#### Layout

Mirrors `fjs/media/json/`:

```text
fjs/media/datajs/
    README.md         landed
    types.ts          Primitive, Unknown — landed
    module.f.mjs      the public API below
    proof.f.mjs
    parser/           module.f.mjs, proof.f.mjs, types.ts — landed; `parse`, over text
    serializer/       module.f.mjs, proof.f.mjs
```

There is no `tokenizer/`: the reader is the grammar (§3).

**Every entry point is fallible, and the names say so.** A caller may
legitimately hand a reader invalid text or a serializer a value outside the
data model, so all of them are `try*` returning `Result` — see §4:

```ts
export const tryParseBytes: (bytes: List<U8>) => Result<Unknown, string>
export const tryParse:      (text: string)    => Result<Unknown, string>
export const trySerialize:  (value: unknown)  => Result<List<string>, string>
export const tryStringify:  (value: unknown)  => Result<string, string>
export const tryNormalize:  (value: unknown)  => Result<string, string>
```

**The byte path is not a convenience, it is a conformance obligation.** Two
document rules cannot be reached from a code-unit array at all — a document has
**no BOM**, and a document **is UTF-8** — and
[the corpus](../../../../spec/datajs/todo/conformance-vectors.md) carries their
vectors as byte arrays "fed to the reader's public byte-accepting path — which
stage 4 owes". By the time input is a JavaScript string both distinctions are
gone, so `tryParse` alone can neither implement nor prove them. `tryParseBytes`
decodes with [`fjs/text/utf8`](../../../text/utf8/module.f.mjs)'s
`toCodePointList`, refuses invalid UTF-8, **rejects** a leading `EF BB BF`, and
then re-encodes with [`fjs/text/utf16`](../../../text/utf16/module.f.mjs)'s
`fromCodePointList` before the reader sees a symbol, because the reader's
symbols are UTF-16 code units (§3): a four-byte scalar such as `😀`
decodes to the one code point `0x1F600`, and the grammar must receive the
pair `0xD83D 0xDE00`, which is what the corpus's four-byte vectors require to
succeed. The byte path and the string path share one reader over one
alphabet; the bridge is the decoder's, not the mapping's.

That last word matters, and an earlier draft of this file had it backwards.
"A document is UTF-8. It has no BOM" is a *rejection* rule: a BOM makes the byte
sequence invalid, it is not something to remove on the way in. Stripping is
exactly the defect the vector exists to catch — the corpus says the case needs
bytes because "a decoder satisfies the parser on [it] by stripping `EF BB BF`
before the parser ever runs", so an implementation that strips passes every
code-unit vector while accepting a document the spec refuses.

**There is no `sort` seam, and that is a difference from JSON rather than an
omission.** `fjs/media/json` takes a `_MapEntries` so a caller can canonicalize;
DataJS cannot offer that, because **observable key order is part of the value**.
The spec fixes it — array-index keys numerically first, then the rest in
first-occurrence order — and lists what a serializer *is* free to choose:
whitespace and layout, the names of the consts, and whether a singly-reachable
value is hoisted. Key order is not on that list. A caller-supplied mapping that
reordered non-index keys would emit a valid document denoting a **different
object**, and return `ok` while doing it — the silently-wrong document the spec
exists to prevent. The serializer enumerates in the mandated order and takes no
say in it.

`trySerialize` yields chunks and `tryStringify` is its `concat`, mirroring
`fjs/media/json`'s pair minus that parameter. `tryNormalize` stays separate
because normalized form is an optional conformance role a caller asks for. The
input is `unknown` rather than `Unknown` precisely because rejecting what is
outside the model is the serializer's job — a signature taking `Unknown` would
be asserting what §4 has to check.

#### 1. Value domain, and the one type-level trap

```ts
export type Primitive = null | boolean | string | number | bigint | undefined
export type Unknown = Tree<Primitive>
```

reusing `Tree<P>` from [`fjs/media/json/types.ts`](../../json/types.ts).

`TreeObject<P>` is `{ readonly [k in string]?: Tree<P> }`. With `undefined` in
`Primitive`, **`{a: undefined}` and `{}` have the same type** — the optional
index signature makes "present and `undefined`" indistinguishable from "absent".
The spec makes them different documents:

```js
export default {"a":undefined};   // an object with one member
export default {};                // an object with none
```

so only the *runtime* enumerator can tell them apart. Consequences, both of
which are proof obligations rather than notes:

- the serializer must not read an object through `definedEntries`, which drops
  a member whose value is `undefined` before any other seam runs. It must not
  read it through `entries` either — see §4: `Object.entries` invokes a getter
  while collecting its value, which is the effect §4 rejects. **Own property
  descriptors settle both at once**: a descriptor exists if and only if the
  property does, so present-and-`undefined` is distinguishable from absent
  without reading any value, and an accessor is visible as an accessor before
  anything invokes it.
- the parser must build a member whose value is `undefined` as a present
  property, which it does through `Object.fromEntries` and which no type will
  check — its proof pins it.

This is [157](../../../djs/todo/157-json-djs-shared-value-machine.md)'s fourth
seam met from the other side, and it interacts with
[663](../../../djs/todo/663-json-djs-tree-type.md).

#### 2. Tokenizer

There is none. The reader is the grammar at
[`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs), which imports
JSON's rules — the string rule unchanged, the number core extended — and adds
the rest: `id` (`'$' [A-Za-z0-9_$]*`), `;`, `=`, and the words `const`,
`export`, `default`, `undefined`, `NaN`, `Infinity`. Three rules the spec
states and the reader's proof pins:

- **`bigint` is its own production**, `'-'? int 'n'` — `1.5n` and `1e2n` are
  refused, because JavaScript refuses them.
- **`-` belongs to the token that follows it**, and only to `number`, `bigint`
  and `infinity`. `-NaN`, `-undefined`, `-true` and a bare `-` have no rule.
- **Whitespace is required after `const`, `export` and `default`**, at three
  positions with no condition attached, and is otherwise insignificant. The
  four permitted characters are JSON's; every other character JavaScript
  treats as whitespace or a line terminator (U+2028, U+2029, NBSP, FF, VT,
  BOM) is **refused** wherever it appears outside a string.

#### 3. Parser

**Settled: the reader is the grammar, mapped straight to values** — the
first of the two routes this section used to leave open. The token-driven
container machine is retired for this format rather than widened, so the
four seams that route measured as too narrow (the `NumberPolicy` type, the
closed `_ValueToken` set, string-only keys, and the sorting `OrderedMap`
members accumulated in) are moot and their prerequisite work on
`fjs/media/json/parser` is not owed.

What landed, in [`../parser/module.f.mjs`](../parser/module.f.mjs):

- **The fold.** A rewrite set over the grammar, folded by
  [`fjs/ebnf/ll1`](../../../ebnf/ll1/README.md) as it parses: JSON's own
  `string` mapping, exported by JSON's reader for exactly this reuse; `number`
  to its leaf — `Number` or `BigInt` chosen from the branch, so `1` and `1n`
  never meet, `-0` keeps its sign and `-0n` is `0n`; and `value` to a node —
  a leaf, a container of nodes in the order written, a reference by name, or
  a refusal where a member's string key decodes to `__proto__`, standing in
  the value's place. The grammar's `value` is typed `DataJsValue`, the
  recursive alias the widened-rule-signatures issue asked for, so every
  mapping is typed from its rule.
- **The resolution.** The layer above the fold, holding the environment: the
  statements are read off the document's tree in order, each `const` bound —
  once — to its value resolved against the names before it, and the export
  resolved against them all. A name binds after its value, so `const $0=$0;`
  names nothing. A reference resolves to the very value its `const` bound,
  which is what keeps the sharing (`const $0=[];export default [$0,$0];` is
  one array twice), and every container written out is a node of its own
  (`export default [[],[]];` is two). Resolution walks an explicit stack, so
  it keeps the depth contract the fold keeps: 5,000 nested brackets resolve
  with a reference at the bottom.
- **The document.** `[dataJs, eof]`, over UTF-16 code units, so a trailing
  symbol is refused and a lone surrogate is one unit in and one out. A parse
  that fails reports where, `unexpected end` or `unexpected symbol at N`, as
  JSON's does; a document the three post-recognition rules refuse reports
  the first broken in document order.

Member order needs no seam: `Object.fromEntries` over the entries as written
is the order the spec restates — array-index keys first by numeric value,
the rest in first-occurrence order, a duplicate keeping its first position and
taking its last value — and a member holding `undefined` is a present property.

What is not landed is the byte path of §Layout — `tryParseBytes`, refusing
invalid UTF-8 and a leading BOM before the reader sees a unit — which the
corpus's byte-form vectors require.

#### 4. Serializer

Two passes, and the first is where the errors are.

**Pass 1 — validate and count, in that order, in one traversal.** This pass is
the *first* thing that touches the caller's graph, so it is where the
descriptor-first rule of §4 has to hold — not in pass 2. Counting occurrences
means following outgoing edges, and following an edge on an ordinary enumerator
reads the property, which invokes an enumerable getter below the root before
anything has had the chance to refuse it. So each node is validated from its own
property descriptors as it is reached, and only the surviving data descriptors'
values are followed. Validation and traversal are one walk because the traversal
is what makes validation necessary.

**Container kind is checked before descriptors, not by them.** Descriptor
validation cannot see the difference between `{}` and a `Date`: measured, `new
Date()`, `new Map()`, `new Set()` and `new Number(1)` each have **zero** own
property descriptors and zero own symbols, exactly like `{}`, and each
classifies as an object container. So descriptor-only validation finds nothing
to refuse and pass 2 would serialize any of them as `{}` — a document denoting
something else, silently, which is the case the spec rejects as "a leaf outside
the leaf set — a function, a symbol, a `Date`, or any other non-plain object".

The check is therefore positive and closed rather than a list of built-ins to
exclude: a value that is `typeof 'object'` and not `null` and not an array must
be a **plain object**, meaning its prototype is `Object.prototype` or `null` —
the spec permits a null-prototype object explicitly and says it serializes as
its data. Reading a prototype to classify is not replacing one, so this stays
inside the rule in [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1.

Then count **incoming reference occurrences** per object/array node, by
reference identity.
Primitives are never counted: the spec declines to hoist them, and counting
them by value would raise the `0`/`-0` and `NaN` questions the `Object.is`
guarantee forbids answering. A node with more than one occurrence is hoisted.

The spec's own worked example is the test: for `root=[p,p]` with `p=[c]`, `p`
has two occurrences and is hoisted while `c` has exactly one and stays inline
— *even though two paths reach it*. An implementation counting root-to-node
paths gets `c` wrong and passes the simple cases.

This pass is also **where cycle rejection lives**. It has to mark nodes in
progress regardless, or it does not terminate; the spec requires rejecting a
cycle rather than inventing a spelling, so the marking and the rejection are
one mechanism.

Emission order is **post-order of one depth-first traversal** — arrays in
element order, objects in observable key order, descending into a shared node
only the first time it is met — with names `$0`, `$1`, … in emission order.
Post-order is what puts a node's dependencies before it, which declare-before-use
requires. The spec's example: for `root = [parent, parent, child]` with `child`
inside `parent`, `child` is `$0` and `parent` is `$1`.

**Pass 2 — the walk.** The shared walker of
[157 §2](../../../djs/todo/157-json-djs-shared-value-machine.md) with its four
seams: a leaf seam, a **pre-recursion** ref-lookup seam (it must run *before*
container dispatch, or a shared array short-circuits to nothing and the
reference is lost), a key seam, and the entry-enumeration seam of §1 above.
Stage 4 is the consumer 157 §2 was waiting for.

**Rejection is a `try*`, not a panic.** A serializer's input is caller-supplied
and may legitimately be outside the data model, which is
[`REVIEW.md`](../../../../doc/REVIEW.md)'s first case — refused as a `try*`, never
asserted on. Which refusal type is a choice to make rather than blur: the
convention names `Nullable<T>`, while `fjs/media/json/parser` next door returns
`Result<_, string>` and carries a message. Prefer `Result` here, since the
rejections below are distinguishable and a caller handed a cyclic value is
owed better than `null`. Rejected: a leaf outside the leaf set, a sparse hole, a symbol
key, an accessor property, a non-enumerable property, an array with an own
property besides its elements and `length`, and a cycle.

**Order matters: validate from descriptors, then read — and the *first*
traversal is the one that has to do it.** Rejecting an accessor because reading
it is an effect is worthless if the check itself reads it, and the obvious
enumerator does exactly that — measured, `Object.entries` on an object with an
enumerable getter invokes the getter once and hands back its value. So each node
is read as own property descriptors plus own symbol keys; symbol keys,
accessors and non-enumerable properties are refused from the descriptors alone;
and only the surviving data descriptors' `value`s are read. Nothing outside the
model is ever read.

That belongs to **pass 1**, because pass 1 is what first follows an edge — a
rule stated only for the walk would leave an enumerable getter below the root
invoked during counting. Pass 2 then re-reads a graph pass 1 has already
cleared. The same mechanism answers §1's present-vs-absent problem, since a
descriptor exists exactly when the property does, so one walk serves all three.

Two further lines are easy to cross and the spec draws both explicitly:

- **Property attributes are not grounds for rejection.** `writable`,
  `configurable`, and whether the object is frozen or sealed are outside the
  data model, not errors. Rejecting them would make `Object.freeze`d values
  unserializable — including the output of a reader that freezes what it
  returns, which the spec permits. Only **enumerability and accessors** are
  rejected, because they change which values appear at all.
- **A hole is not an `undefined` element.** `undefined` is a leaf here, so
  `0 in a` decides it and `a[0] === undefined` does not.

#### 5. Normalized form

A separate entry point, since it is optional and a caller asks for it.

| Part | This host |
|---|---|
| numbers | `` `${value}` `` — on a JavaScript host that *is* ECMAScript `ToString`, which the spec restates only for hosts that disagree — with `-0` written `-0`, and `NaN`/`Infinity`/`-Infinity` as words. `fjs/media/json/extended` already has this shape, except that it writes `null` for non-finite. |
| bigints | `` `${value}n` `` — `BigInt`'s decimal form plus the suffix; no exponent at any magnitude. |
| strings | `stringSerialize` from [`fjs/media/json/serializer`](../../json/serializer/module.f.mjs), **unchanged** — it already reproduces `QuoteJSONString` exactly, lone surrogates included. |
| key order | the host's own. JavaScript already orders array-index keys numerically ahead of the rest; the spec restates the rule for languages that do not. |

Layout is one line, a single space after `const`, `export` and `default` and
nowhere else, no indentation, no trailing newline.

#### 6. Proofs

The proof source is the stage 1b corpus,
[`spec/datajs/todo/conformance-vectors.md`](../../../../spec/datajs/todo/conformance-vectors.md),
which is why the stage plan puts 1b before this issue: landing stage 4 first
means writing its proofs twice.

Proofs are **per role** — reader, serializer, normalized serializer — because
the spec judges them independently and this module provides all three.

### Tasks

- [x] **First: settle whether the reader is the grammar or the token machine**
      (§3). The grammar; the token machine is retired for this format.
- [x] `fjs/media/datajs/types.ts` and `README.md`.
- [x] Reader: `fjs/ebnf/lib/datajs` composed with `eof`, over UTF-16 code
      units, folded to nodes; the statement layer with its environment,
      bound-once and declare-before-use; the key rule on the decoded value.
- [x] Reader proofs derived from the specification by hand, both sharing
      directions included.
- [ ] Reader proofs from the corpus once stage 1b lands, and the byte path —
      `tryParseBytes` — with the BOM and invalid-UTF-8 vectors the corpus
      assigns to stage 4.
- [ ] `module.f.mjs`, the public API of §Layout, once there is more than the
      reader to hold.
- [ ] Pass 1: container-kind check then descriptor-first validation as each
      node is reached, occurrence counting by identity, cycle rejection,
      post-order naming — one traversal, since it is the first thing to touch
      the caller's graph. Prove the empty non-plain built-ins (`Date`, `Map`,
      `Set`, boxed number), which no descriptor check can catch.
- [ ] Serializer over the shared walker of 157 §2.
- [ ] Out-of-model rejection as a `try*`, descriptor-first so no accessor is
      invoked by the check that refuses it, with the attribute/enumerability
      line and the hole-vs-`undefined` distinction proved.
- [ ] Normalized form, and its byte-exact proofs.
- [ ] Delete this file in the PR that finishes it.

### Related

- [`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md) — the coordinating plan; this is its stage 4.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — normative. This issue implements it.
- [`spec/datajs/todo/conformance-vectors.md`](../../../../spec/datajs/todo/conformance-vectors.md) — stage 1b, the proof source. Land it first.
- [JSON's reader](../../json/todo/self-contained-tokenizer.md) — stage 3, open with its error shapes undecided. Over a grammar the reuse is of rules and of the `string` mapping, which [`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs) and [`../parser`](../parser/module.f.mjs) do by import.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — the shared serializer walker and its four seams. Stage 4 is its second consumer.
- [663](../../../djs/todo/663-json-djs-tree-type.md) — the tree type; interacts with the optional index signature in §1.
