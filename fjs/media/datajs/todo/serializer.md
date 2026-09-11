## DataJS serializer

**Priority:** P1 — it is what is left of stage 4 beside the reader's byte path,
and stage 4 is the deliverable
[the coordinating plan](../../../../todo/parser-serializer-restructure.md)
calls the one everything else is waiting for.
**Status:** open — none of the writer exists. The reader landed;
[`fjs/media/datajs`](../README.md) has no `serializer/` at all.
**Blocked by:** nothing, for the implementation. Its **proofs** wait on the
four writer-side sets of
[stage 1b](../../../../spec/datajs/todo/conformance-vectors.md) —
`serializer-accept`, `serializer-reject`, `graph-equivalence`, `normalize` —
which are typed in [`../vectors/types.ts`](../vectors/types.ts) and not yet
written.

### Problem

The reader landed on the grammar route and
[`parser-serializer.md`](./parser-serializer.md) keeps what remains of it —
`tryParseBytes` and the corpus proofs. This file is the other half, and none of
it exists: `fjs/media/datajs` reads and cannot write.

The specification is finished and normative.
**This issue implements it and does not redesign it.** Where the two disagree
[`spec/datajs/README.md`](../../../../spec/datajs/README.md) wins, and a
disagreement is a bug in this file.

Two things make writing harder than reading, and each is a section below:

- a document denotes a **DAG**, so a node reachable more than once must be
  hoisted into a `const` — inlining it at each occurrence emits a valid
  document denoting *equal copies*, a different graph;
- a serializer's input is an ordinary programmatic value, so most of the work
  is **refusing** what is outside the data model, and refusing it without
  reading it.

### Proposal

#### Layout and API

```text
fjs/media/datajs/
    serializer/
        module.f.mjs
        proof.f.mjs
        private.ts    if the walk's seams need names
```

Three of the five entry points
[`parser-serializer.md`](./parser-serializer.md#layout) lists are this file's:

```ts
export const trySerialize: (value: unknown) => Result<List<string>, string>
export const tryStringify: (value: unknown) => Result<string, string>
export const tryNormalize: (value: unknown) => Result<string, string>
```

`trySerialize` yields chunks and `tryStringify` is its `concat`, mirroring
[`fjs/media/json`](../../json/module.f.mjs)'s pair. `tryNormalize` stays
separate because normalized form is an optional conformance role a caller asks
for. The input is `unknown` rather than [`Unknown`](../types.ts) precisely
because rejecting what is outside the model is the serializer's job — a
signature taking `Unknown` would be asserting what §1 has to check.

**Rejection is a `try*`, not a panic.** A serializer's input is
caller-supplied and may legitimately be outside the data model, which is
[`REVIEW.md`](../../../../doc/REVIEW.md)'s first case — refused as a `try*`,
never asserted on. `Result<_, string>` rather than `Nullable<T>`: the
rejections are distinguishable, a caller handed a cyclic value is owed better
than `null`, and [`../parser`](../parser/module.f.mjs) next door already
carries a message.

**There is no `sort` seam, and that is a difference from JSON rather than an
omission.** `fjs/media/json` takes a `_MapEntries` so a caller can
canonicalize; DataJS cannot offer that, because **observable key order is part
of the value**. The spec fixes it — array-index keys numerically first, then
the rest in first-occurrence order — and lists what a serializer *is* free to
choose: whitespace and layout, the names of the consts, and whether a
singly-reachable value is hoisted. Key order is not on that list. A
caller-supplied mapping that reordered non-index keys would emit a valid
document denoting a **different object**, and return `ok` while doing it — the
silently-wrong document the spec exists to prevent. The serializer enumerates
in the mandated order and takes no say in it.

#### 1. Pass 1 — classify, validate, count, in one traversal

This pass is the *first* thing that touches the caller's graph, so every rule
below has to hold here rather than in the walk: counting occurrences means
following outgoing edges, and following an edge on an ordinary enumerator
reads the property, which invokes an enumerable getter below the root before
anything has had the chance to refuse it.

**Container kind is checked before descriptors, not by them.** Descriptor
validation cannot see the difference between `{}` and a `Date`: measured,
`new Date()`, `new Map()`, `new Set()` and `new Number(1)` each have **zero**
own property descriptors and zero own symbols, exactly like `{}`. So
descriptor-only validation finds nothing to refuse and the walk would
serialize any of them as `{}` — a document denoting something else, silently,
which is the case the spec rejects as "a leaf outside the leaf set — a
function, a symbol, a `Date`, or any other non-plain object".

The check is therefore positive and closed rather than a list of built-ins to
exclude:

- a leaf is `null`, a `boolean`, a `string`, a `number`, a `bigint` or
  `undefined`, and is always written inline;
- an array is an array whatever its prototype — the spec serializes a
  `null`-prototype array and an `Array` subclass instance as their data — and
  **this is the one place the repository's own spelling does not hold**:
  `instanceof Array`, which [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1 names as
  the spelling to use, is `false` for a `null`-prototype array, where
  `Array.isArray` is `true`. The corpus issue's decision 2 and
  [`difference`](../vectors/module.f.mjs) both read `Array.isArray`, so the
  serializer does too, and the rule's exception is worth writing down where it
  is taken rather than discovering twice;
- an object is `typeof 'object'`, non-null, not an array, and **plain**:
  its prototype is `Object.prototype` or `null`, which the spec permits
  explicitly;
- everything else is rejected, `Object.create({x: 1})` included — that
  boundary is decision 2 of
  [the corpus issue](../../../../spec/datajs/todo/conformance-vectors.md),
  and [`difference`](../vectors/module.f.mjs) already draws it the same way.

Reading a prototype to classify is not replacing one, so this stays inside the
rule in [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1.

**Then validate from descriptors, and read only what survives.** Rejecting an
accessor because reading it is an effect is worthless if the check itself
reads it, and the obvious enumerator does exactly that — measured,
`Object.entries` on an object with an enumerable getter invokes the getter
once and hands back its value. So each node is read as own property
descriptors plus own symbol keys; symbol keys, accessors and non-enumerable
properties are refused from the descriptors alone, an array's own `length`
being the one exception the spec names; an array carrying an own key that is
neither an index below `length` nor `length` is refused; an index below
`length` with no own descriptor is a **hole**, refused; and only the surviving
data descriptors' `value`s are followed. Nothing outside the model is ever
read.

The same mechanism answers the present-versus-absent problem of
[`parser-serializer.md`](./parser-serializer.md) §1: a descriptor exists if and
only if the property does, so a member holding `undefined` is distinguishable
from an absent one without reading any value. `definedEntries`, which
[`treeSerialize`](../../json/serializer/module.f.mjs) reads objects through,
drops such a member before any other seam runs.

Two further lines are easy to cross and the spec draws both explicitly:

- **Property attributes are not grounds for rejection.** `writable`,
  `configurable`, and whether the object is frozen, sealed or extensible are
  outside the data model, not errors. Rejecting them would make
  `Object.freeze`d values unserializable — including the output of a reader
  that freezes what it returns, which the spec permits. Only **enumerability
  and accessors** are rejected, because they change which values appear at all.
- **A hole is not an `undefined` element.** `undefined` is a leaf here, so an
  own descriptor decides it and `a[0] === undefined` does not.

**Count incoming reference occurrences** per container node, by reference
identity. An occurrence is one place the node appears: an array element, a
member value, or the exported value. Primitives are never counted: the spec
declines to hoist them, and counting them by value would raise the `0`/`-0`
and `NaN` questions the `Object.is` guarantee forbids answering. A node with
more than one occurrence is hoisted.

The spec's own worked example is the test: for `root=[p,p]` with `p=[c]`, `p`
has two occurrences and is hoisted while `c` has exactly one and stays inline
— *even though two paths reach it*. An implementation counting root-to-node
paths gets `c` wrong and passes the simple cases.

**Cycle rejection lives here too.** The traversal has to mark nodes in
progress regardless, or it does not terminate; the spec requires rejecting a
cycle rather than inventing a spelling, so the marking and the rejection are
one mechanism. In progress and finished are different marks: meeting a
finished node again is sharing, meeting one still in progress is a cycle.

**Emission order falls out of this pass.** It is **post-order of one
depth-first traversal** — arrays in element order, objects in observable key
order, descending into a shared node only the first time it is met — with
names `$0`, `$1`, … in emission order. Post-order is what puts a node's
dependencies before it, which declare-before-use requires. The spec's example:
for `root = [parent, parent, child]` with `child` inside `parent`, `child` is
`$0` and `parent` is `$1`.

**The state is threaded, not mutated.** Identity keying means a `Map` or `Set`
of nodes, and [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1 forbids `Map#set` and
`Set#add` on a value already built. `getConstants` in
[`fjs/djs/serializer`](../../../djs/serializer/module.f.mjs) shows the shape —
a fold over a `{ added, consts }` state, rebuilt per node — and also shows its
cost, a copy per node; the mutable `Refs` beside it is what
[157](../../../djs/todo/157-json-djs-shared-value-machine.md) warns against
carrying anywhere shared. Pick the simple one first and leave the cost
measured rather than assumed.

#### 2. Pass 2 — the walk

A document is the hoisted nodes as `const` statements in the order pass 1
fixed, then `export default` of the root — a `$N` reference when the root is
itself hoisted.

The walk is the shared value machine of
[157 §2](../../../djs/todo/157-json-djs-shared-value-machine.md) with its four
seams, and stage 4 is the consumer that issue was waiting for:

1. **a leaf seam** — `stringSerialize`, `boolSerialize` and `nullSerialize`
   from [`fjs/media/json/serializer`](../../json/serializer/module.f.mjs)
   unchanged; `undefined` as the one-element `['undefined']` that
   [`fjs/djs/serializer`](../../../djs/serializer/module.f.mjs) already exports;
   a bigint through [`fjs/types/bigint`](../../../types/bigint/module.f.mjs)'s
   `serialize`, which is the decimal digits plus `n`. Numbers are **not**
   JSON's `numberSerialize`: it is `JSON.stringify`, which writes `null` for
   `NaN` and the infinities, and DataJS spells them as words (§3).
2. **a pre-recursion ref seam** — it must run *before* container dispatch, or a
   shared array short-circuits to nothing and the reference is lost. This is
   the one seam the JSON walker cannot express as a leaf spelling.
3. **a key seam** — an own enumerable string key `__proto__` is emitted as the
   exact computed form `["__proto__"]`, the only spelling the reader accepts,
   which makes it a requirement of round-tripping rather than a style choice.
   `jsKeySerialize` in `fjs/djs/serializer` is that function today, private.
4. **an entry-enumeration seam** — the descriptors of §1, not `definedEntries`
   and not `entries`.

**Two** of the four are already parameters of `buildSerialize` in
`fjs/djs/serializer` — the key seam and the pre-recursion ref seam — and the
other two are fixed inside it: the leaf spelling is a `switch` in the
function body, and the entry enumeration is `entries`. Its third parameter,
`sort`, is not one of the four seams at all, and is the one seam §Layout and
API says DataJS cannot have. 157 §2 counts three, but words it "already
parameters of `buildSerialize` **or forced by it**", which is the sentence
this one lost the qualifier from.

The factory is private there besides. Whether DataJS reuses it — widened by
the two seams above, and exported — reuses a walker extracted per 157 §2, or
writes its own is 157's open question and this is where it gets decided,
under [`AGENTS.md`](../../../../AGENTS.md) §1's rule that an export beats a
copy.

#### 3. Normalized form

One specific serializer, chosen so that a value has exactly one byte spelling.
Everything §1 and §2 do is unchanged; what normalized form removes is the
freedom:

| Part | This host |
|---|---|
| layout | one line; a single space after `const`, after `export` and after `default` and nowhere else; no indentation, no trailing newline |
| hoisting | mandatory and exact — hoisted **if and only if** the node is a container with more than one occurrence, so a singly-reachable node is inline |
| numbers | `` `${value}` `` — on a JavaScript host that *is* ECMAScript `ToString`, which the spec restates only for hosts that disagree — with `-0` written `-0`, and `NaN`/`Infinity`/`-Infinity` as words. [`fjs/media/json/extended`](../../json/extended/module.f.mjs) already has this shape, except that it writes `null` for non-finite |
| bigints | `` `${value}n` `` — no exponent at any magnitude, and never `-0n`, which `BigInt` cannot produce |
| strings | `stringSerialize` from [`fjs/media/json/serializer`](../../json/serializer/module.f.mjs), **unchanged** — it already reproduces `QuoteJSONString` exactly, lone surrogates included |
| key order | the host's own. JavaScript already orders array-index keys numerically ahead of the rest; the spec restates the rule for languages that do not |

The thresholds the spec pins are the proofs worth writing: `1e20` is
`100000000000000000000` while `1e21` is `1e+21`, and `1e-6` is `0.000001`
while `1e-7` is `1e-7`.

#### 4. Proofs

Proofs are **per role** — serializer and normalized serializer — because the
spec judges them independently, and the proof source is the corpus rather than
the reader: proving the writer against the reader proves them against each
other, which is the drift the corpus exists to stop.

Four sets, all typed in [`../vectors/types.ts`](../vectors/types.ts) and none
written yet:

| set | what the proof does |
|---|---|
| `serializer-accept` | serialize the input, read it back, compare with [`difference`](../vectors/module.f.mjs) against the vector's graph |
| `serializer-reject` | assert an `error`, and that the rule it names is the one refused |
| `graph-equivalence` | every document in `denotes` reads back equal to the input, every one in `denotesNot` does not — the sharing claims, which a single round trip cannot make |
| `normalize` | compare `tryNormalize`'s output to the vector's `text`, byte for byte |

Three of those read back through [`../parser`](../parser/module.f.mjs), so the
serializer's proofs are round trips whose comparison is `difference`, the
sharing-aware one — structural equality would pass a serializer that inlined a
shared node. The host recipes an input may carry are built by `build`, which
[stage 1b](../../../../spec/datajs/todo/conformance-vectors.md) owns and places
in `fjs/media/datajs/vectors/module.mjs` — a getter that records its own
invocation is an effect, which is why that one is `.mjs`. The accessor vectors
are what prove the descriptor-first rule of §1: a serializer that refuses an
accessor *after* reading it passes a vector that only checks the rejection.

### Tasks

- [ ] `module.f.mjs`, the public API of
      [`parser-serializer.md`](./parser-serializer.md#layout), once there is
      more than the reader to hold.
- [ ] Pass 1 as one traversal: container-kind check, then descriptor-first
      validation as each node is reached, occurrence counting by identity,
      cycle rejection, post-order naming. Prove the empty non-plain built-ins
      (`Date`, `Map`, `Set`, boxed number), which no descriptor check can catch,
      and the `null`-prototype array, which is where the array test's spelling
      is decided.
- [ ] Decide §2's walker question with 157: export `buildSerialize`, extract a
      shared one, or write DataJS's own — and say which in 157 either way.
- [ ] Pass 2 over that walker, with the four seams and the `["__proto__"]` key
      spelling.
- [ ] Out-of-model rejection as a `try*`, descriptor-first so no accessor is
      invoked by the check that refuses it, with the attribute/enumerability
      line and the hole-versus-`undefined` distinction proved.
- [ ] Normalized form and its byte-exact proofs, the `1e20`/`1e21` and
      `1e-6`/`1e-7` thresholds included.
- [ ] Proofs over the four writer-side sets as stage 1b lands them.
- [ ] Delete this file in the PR that finishes it.

### Related

- [`parser-serializer.md`](./parser-serializer.md) — the reader half of stage 4 and the shared public API; this file was split out of it.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — normative. §Serialization and §Normalized form are what this implements.
- [`spec/datajs/vectors/README.md`](../../../../spec/datajs/vectors/README.md) — the corpus schema; the writer-side sets are the proof source.
- [`spec/datajs/todo/conformance-vectors.md`](../../../../spec/datajs/todo/conformance-vectors.md) — stage 1b, which owns those sets and `build`.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — the shared serializer walker and its four seams. This is its second consumer.
- [663](../../../djs/todo/663-json-djs-tree-type.md) — the tree type, whose optional index signature is why only the runtime enumerator sees a member holding `undefined`.
- [`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md) — the coordinating plan; this is the rest of its stage 4.
