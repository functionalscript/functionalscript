## DataJS serializer

**Priority:** P1 — it is what is left of stage 4 beside the reader's byte path,
and stage 4 is the deliverable
[the coordinating plan](../../../../todo/parser-serializer-restructure.md)
calls the one everything else is waiting for.
**Status:** wip — **the writer landed**, as
[`fjs/media/datajs/serializer`](../serializer/module.f.mjs): `trySerialize`
and `tryStringify` over the three passes of §1–§3, refusing everything the
specification refuses, with every rule of §1 proved and the two worked
examples of the hoisting and naming rules pinned. What remains is the
corpus proofs (§4), the module's own `module.f.mjs`, and a readable layout
if one is wanted (§3).
**Blocked by:** nothing, for what is left of the implementation. The
**corpus proofs** wait on the four writer-side sets of
[stage 1b](../../../../spec/datajs/todo/conformance-vectors.md) —
`serializer-accept`, `serializer-reject`, `graph-equivalence`, `normalize` —
which are typed in [`../vectors/types.ts`](../vectors/types.ts) and not yet
written, and the host-input half of them waits on that issue's **decision
6** besides.

### Problem

The reader landed on the grammar route and
[`parser-serializer.md`](./parser-serializer.md) keeps what remains of it —
`tryParseBytes` and the corpus proofs. This file is the other half: the
writer, which landed as described under **Status** above. What is written
below is the design it was built to; where a section is done, it says so and
records what the implementation settled.

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
        module.f.mjs  landed
        proof.f.mjs   landed
        types.ts      landed — the flat graph, `_Value`, `_Node`, `_Graph`
        private.ts    landed — the read's own state
```

Three of the five entry points
[`parser-serializer.md`](./parser-serializer.md#layout) lists are this
file's. **Two landed, and the third is deliberately not a function:**

```ts
export const trySerialize: (value: unknown) => Result<List<string>, string>
export const tryStringify: (value: unknown) => Result<string, string>
```

`tryNormalize` is absent because the writer that landed **is** the
normalized one: layout is the freedom the specification gives a writer, and
with one writer there is nothing to choose, so a separate entry point would
be the same function under a second name. The day a readable layout lands —
one statement per line, indented containers, the default the specification
recommends for tooling — it is the second entry point and `tryNormalize`
names this one. Until then `tryStringify`'s output is byte-exact normalized
form, and its proof pins the bytes.

The module's own `module.f.mjs`, the public surface both roles share, is
still owed and is where the naming question `parse` versus `tryParse` gets
settled; the writer is reached at `serializer/module.f.mjs` today, as the
reader is at `parser/module.f.mjs`.

`trySerialize` yields chunks and `tryStringify` is its `concat`, mirroring
[`fjs/media/json`](../../json/module.f.mjs)'s pair. The input is `unknown`
rather than [`Unknown`](../types.ts) precisely because rejecting what is
outside the model is the serializer's job — a signature taking `Unknown`
would be asserting what §1 has to check.

Three more names are exported and are **not** API: `_memberValue`,
`_elementNames` and `_link`, the rules of §1 as functions over the data a
host value would carry. The `_` prefix is the repository's mark for a name
whose export is linkage rather than contract
([`fjs/AGENTS.md`](../../../AGENTS.md) §3.2), which is what these are: the
proof reaches them because no FunctionalScript value can reach the refusals
they make.

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

**Landed, in three passes rather than two, and the split is the one
deviation from this section.** `read` classifies and validates and reads
every container once; `link` replaces each host object by the index of its
node and refuses a cycle; `write` emits. Cycle rejection moved out of the
read for a reason worth keeping: the read holds a container in `started`
from before its members are read, so it never re-enters one and *terminates*
on a cyclic value without deciding anything — and `link` then refuses the
graph by the only thing a cycle leaves behind in it, a reference that points
forwards. That is what makes the refusal provable at all. A cycle is not a
value FunctionalScript can build, so a check inside the read could never be
reached from a proof, where a graph carrying a forward reference is ordinary
data. The same move made `memberValue` and `elementNames` functions over a
descriptor and over a list of names, for the same reason:
[`fjs/AGENTS.md`](../../../AGENTS.md) §1.6 keeps host-built inputs out of a
`.f.mjs` proof, and §1.2 wants every branch covered, so a rule that only a
host value can trigger has to be a function over the data that value would
carry.

Two costs are now measured rather than assumed. The read rebuilds
`started` per container (`new Set([...prev, value])`), and `shared` counts
occurrences with `indexOf`, so both are quadratic in the number of
containers; and `read` and `write` recurse on the call stack, where the
reader walks an explicit one and keeps its 5,000-level depth contract. Both
are simple-first choices, not measurements that came out well — a document
deep enough or wide enough to matter is what would change them, and neither
has a vector yet.

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

**Settled: DataJS writes its own walk, and 157's extraction is still
owed.** Of the four seams, `buildSerialize` in `fjs/djs/serializer` takes
two as parameters — the key seam and the pre-recursion ref seam — and
hardcodes the other two: its leaf spelling is a `switch` in the function
body, where DataJS needs `NaN` and the infinities as words rather than
JSON's `null`, and its entry enumeration is `entries`, where DataJS reads
descriptors. Its third parameter, `sort`, is not one of the four seams at
all, and is the one seam §Layout and API says DataJS cannot have. Reusing
the factory would mean widening another module's function by two
parameters and moving a type out of its `private.ts` to keep the signature
publishable, in a pull request about this module; writing the walk here is
some twenty lines.

What that buys is a second implementation of the key seam — `__proto__` as
the computed form — in two places, which is exactly the drift 157 exists to
stop. It is recorded there as the count that extraction now has to answer
for, and named from the spelling here.

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
| `normalize` | compare `tryStringify`'s output to the vector's `text`, byte for byte, since that output is normalized form |

Three of those read back through [`../parser`](../parser/module.f.mjs), so the
serializer's proofs are round trips whose comparison is `difference`, the
sharing-aware one — structural equality would pass a serializer that inlined a
shared node. **That shape landed ahead of the sets**: the writer's proof
already round-trips values of its own through the reader and `difference`,
sharing included, so what the corpus adds is coverage of the specification's
branches rather than the machinery to check them.

The host recipes an input may carry are built by `build`, which
[stage 1b](../../../../spec/datajs/todo/conformance-vectors.md) owns and places
in `fjs/media/datajs/vectors/module.mjs` — a getter that records its own
invocation is an effect, which is why that one is `.mjs`. The accessor vectors
are what prove the descriptor-first rule of §1: a serializer that refuses an
accessor *after* reading it passes a vector that only checks the rejection.

**Those vectors are the half that waits on that issue's decision 6**, which
asks whether a `proof.mjs` may prove a `.f.mjs` API against host-built
inputs its specification names. Until it is answered, the refusals a host
value alone can trigger are proved here against the data such a value would
carry — a descriptor, a list of own property names, a graph with a forward
reference — which is what §1 above records and what the exports of
[`../serializer`](../serializer/module.f.mjs) are shaped for. What that
leaves unproved is the *plumbing* between them: that an object with an
enumerable getter reaches `memberValue` at all, and that no getter is
invoked on the way. Decision 6 is what would close it.

### Tasks

- [x] The read as one traversal: container-kind check, then descriptor-first
      validation as each node is reached, and every container read once.
      The empty non-plain built-ins (`Date`, `Map`, `Set`, boxed number),
      which no descriptor check can catch, are proved.
- [x] Occurrence counting by node, post-order naming, and cycle rejection —
      the last from the linked graph rather than from the read, which is
      what makes it provable (§1).
- [x] §2's walker question, decided: DataJS's own walk, with 157 told what
      that costs.
- [x] The walk with its four seams and the `["__proto__"]` key spelling.
- [x] Out-of-model rejection as a `try*`, descriptor-first so no accessor is
      invoked by the check that refuses it, with the attribute/enumerability
      line and the hole-versus-`undefined` distinction proved.
- [x] Normalized form and its byte-exact proofs, the `1e20`/`1e21` and
      `1e-6`/`1e-7` thresholds included.
- [ ] Proofs over the four writer-side sets as stage 1b lands them, and the
      host-input half of them once that issue's decision 6 is answered.
- [ ] `module.f.mjs`, the public API of
      [`parser-serializer.md`](./parser-serializer.md#layout), once the byte
      path lands beside it — and the `parse` versus `tryParse` naming with it.
- [ ] A readable layout as the second writer, if one is wanted, and
      `tryNormalize` as the name this one takes then (§Layout and API).
- [ ] Measure the two quadratic steps and the recursion depth of §1 against a
      document large or deep enough to matter, and decide whether either is
      worth changing.
- [ ] Delete this file in the PR that finishes it.

### Related

- [`parser-serializer.md`](./parser-serializer.md) — the reader half of stage 4 and the shared public API; this file was split out of it.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — normative. §Serialization and §Normalized form are what this implements.
- [`spec/datajs/vectors/README.md`](../../../../spec/datajs/vectors/README.md) — the corpus schema; the writer-side sets are the proof source.
- [`spec/datajs/todo/conformance-vectors.md`](../../../../spec/datajs/todo/conformance-vectors.md) — stage 1b, which owns those sets and `build`.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — the shared serializer walker and its four seams. This is its second consumer.
- [663](../../../djs/todo/663-json-djs-tree-type.md) — the tree type, whose optional index signature is why only the runtime enumerator sees a member holding `undefined`.
- [`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md) — the coordinating plan; this is the rest of its stage 4.
