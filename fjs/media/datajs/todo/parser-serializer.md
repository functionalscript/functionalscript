## DataJS parser and serializer

**Priority:** P1 — stage 4 is P1 in the coordinating issue and in the
conformance-vector issue, which says outright that it blocks stage 4 "which is
P1". This file is the canonical co-located issue, so it carries the same level.
**Status:** open
**Blocked by:** [JSON self-contained tokenizer](../../json/todo/self-contained-tokenizer.md)

### Problem

`fjs/media/datajs` does not exist. It is stage 4 of
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
- JSON's parser seam is **not wide enough** to be reused as it stands, which is
  prerequisite work on `fjs/media/json/parser` rather than work here.

### Proposal

#### Layout

Mirrors `fjs/media/json/`:

```text
fjs/media/datajs/
    README.md
    types.ts          Primitive, Unknown
    module.f.mjs      the public API below
    proof.f.mjs
    tokenizer/        module.f.mjs, proof.f.mjs, types.ts
    parser/           module.f.mjs, proof.f.mjs, types.ts
    serializer/       module.f.mjs, proof.f.mjs
```

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
`toCodePointList`, refuses invalid UTF-8, and **rejects** a leading `EF BB BF`.

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
  property, which `setReplace` already does and which no type will check.

This is [157](../../../djs/todo/157-json-djs-shared-value-machine.md)'s fourth
seam met from the other side, and it interacts with
[663](../../../djs/todo/663-json-djs-tree-type.md).

#### 2. Tokenizer

Depends on stage 3b, which is what exports JSON's scanners for reuse.

| Piece | Source |
|---|---|
| string scanner | JSON's, **unchanged** — the spec's §Strings is "a JSON string, unchanged" |
| number core | JSON's, extended |
| everything else | new here |

New lexemes: `id` (`'$' [A-Za-z0-9_$]*`), `;`, `=`, and the words `const`,
`export`, `default`, `undefined`, `NaN`, `Infinity`. `true`, `false`, `null`
come from JSON.

Three rules that are easy to get subtly wrong, all of them stated by the spec
and each owed a proof:

- **`bigint` is its own production**, `'-'? int 'n'` — *not* a number followed
  by `n`. `1.5n` and `1e2n` must be rejected, because JavaScript rejects them.
- **`-` belongs to the token that follows it**, and only to `number`, `bigint`
  and `infinity`. `-NaN`, `-undefined`, `-true` and a bare `-` have no rule.
- **Whitespace is required after `const`, `export` and `default`**, at three
  positions with no condition attached to any of them, and is otherwise
  insignificant. The four permitted characters are JSON's; every other
  character JavaScript treats as whitespace or a line terminator (U+2028,
  U+2029, NBSP, FF, VT, BOM) is **rejected** wherever it appears outside a
  string.

#### 3. Parser, in two layers

**Layer 2 — statements.** New, and DataJS-only:

```text
document ::= const* export
const    ::= 'const' id '=' value ';'
export   ::= 'export' 'default' value ';'
```

It carries the environment (name → node), enforces *bound at most once* and
*declare before use*, drives the value machine once per statement, and rejects
anything after the `export`. The environment is what makes forward and unknown
references errors: a reference resolves by lookup, and a failed lookup is a
parse error rather than a `null` leaf.

**Layer 1 — the value machine**, which is `fjs/media/json/parser` generalized.
Measured against the code as it stands, four things are too narrow:

| Today | Why it does not fit |
|---|---|
| `NumberPolicy<P> = (token: NumberToken) => Result<P, string>` | number tokens only; DataJS adds `undefined`, `NaN`, `Infinity`, bigint, and `id` |
| `_ValueToken = Extract<JsonToken, {kind: 'null'\|'false'\|'true'\|'string'\|'number'}>` | a closed set, and `JsonToken` has no `id`, `bigint`, `=` or `;` |
| `parseObjectStartOp`, `parseObjectCommaOp` accept `token.kind === 'string'` | DataJS keys are a string **or** the computed `["__proto__"]` |
| members accumulate in an `OrderedMap`, materialized by `fromMap` | that is a btree keyed by string `cmp`, so members come back **sorted**; DataJS needs first-occurrence order |

so the generalization is:

```ts
/** A leaf seam: any token the machine does not treat structurally. */
export type LeafPolicy<T, P> = (token: T) => Result<Tree<P>, string> | null
```

`null` means "not a leaf token", and the machine reports its existing
`unexpectedToken`. JSON's instantiation accepts exactly today's five kinds;
DataJS's accepts those plus its own leaves plus `id`.

**Member order is a fourth seam, and it is a representation change rather than
a hook.** JSON's machine accumulates members with `setReplace` into an
`OrderedMap` and materializes them with `fromMap`. That map is a btree keyed by
string `cmp`, so it returns members **sorted by key** — deterministic, which is
all JSON needs, and not what DataJS requires. Measured against today's parser:

| document | today | the spec |
|---|---|---|
| `{"b":1,"a":2}` | `a,b` | `b,a` |
| `{"a":1,"b":2,"a":3}` | `a,b` | `a,b`, `a` first with value `3` |
| `{"z":0,"2":0,"1":0,"y":0}` | `1,2,y,z` | `1,2,z,y` |

Index keys land correctly by luck — numeric strings sort into place ahead of
letters for these cases — and every non-index key is wrong whenever the document
does not already list them in sorted order. DataJS's rule is **array-index keys
by numeric value first, then the rest in first-occurrence order**, with a
duplicate taking the last value at the first position, and no key-comparison
function produces that: first-occurrence order is a fact about the input
sequence, not about the keys.

So the members of an object have to accumulate in an order-preserving structure
and be materialized in that order. JSON's own accepted behavior must be pinned
unchanged across the change — its observable key order today is the host's, and
a proof has to say so before this moves.

**The environment does not enter the machine.** An `id` resolves through the
leaf policy, and the statement layer partially applies the current environment
before each statement — so the value machine stays environment-free and JSON's
instantiation is unchanged.

**The key seam is multi-token, and the stage plan's one-line description of it
is under-specified.** `["__proto__"]` is *three* tokens, and whitespace is
insignificant between them, so `[ "__proto__" ]` is the same key. A
`(token) => Result<string, string>` hook cannot express it. Two options:

1. *(recommended)* the key seam is a small fold rather than a function —
   `{ init, step }`, where `step` returns either a next state or a finished
   key. JSON's is one step wide and never leaves `init`; DataJS's has the two
   extra states. The machine's own `status` alphabet stays JSON's, and DataJS's
   extra states live in DataJS's policy.
2. two extra states, `'{['` and `'{["__proto__"'`, in the machine's alphabet.
   Rejected: it puts the literal `"__proto__"` — a DataJS rule — inside JSON's
   parser.

**The seam has to reject as well as accept, and the string branch is where it
does.** Adding the computed form is only half of `__proto__`: DataJS's key
policy must also **refuse a plain string key that decodes to `__proto__`**,
which JSON's one-token path would otherwise finish happily, letting the parser
accept a document the grammar rejects and hand back a plausible wrong value.

The rule is on the **decoded value, not the spelling** — `{"\u005f_proto__":1}`
is rejected exactly as `{"__proto__":1}` is — and the seam is the right place
for it because a `StringToken` already carries `value: string`, the decoded
string, so the policy sees what the key *is* rather than how it was written. No
escape enumeration, and nothing about this reaches JSON's parser.

**JSON's accepted language and behavior must be pinned unchanged across the API
change**, by proofs, in the same PR. That is the whole risk of this seam work.

**Sharing.** `const $0=[];export default [$0,$0];` must read back as *one*
array in two slots. This is automatic on a host with reference identity
provided the leaf policy returns the bound node itself rather than a copy —
which is a real risk, since the machine builds containers freshly via
`toArray` and `fromMap`. The inverse is equally owed and catches the opposite
bug: `export default [[],[]];` must yield two **distinct** nodes, which a
reader that interns what it builds gets wrong while passing every sharing
vector.

**`-0n` is a reader rule with no serializer counterpart.** The grammar accepts
`-0n` as an input spelling of `0n`; bigint has no negative zero, so no value
can ever ask the serializer to emit it. The reader maps the lexeme; the
serializer has nothing to do.

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

- [ ] Widen `fjs/media/json/parser`'s seams: leaf policy, multi-token key
      policy, token vocabulary, and order-preserving member accumulation in
      place of the sorting `OrderedMap`. One PR, with proofs pinning JSON's
      accepted language and observable key order unchanged.
- [ ] `fjs/media/datajs/types.ts` and `README.md`.
- [ ] Tokenizer, over stage 3b's exported scanners.
- [ ] Statement layer: environment, bound-once, declare-before-use.
- [ ] Key policy: accept the computed `["__proto__"]`, and reject a plain
      string key decoding to `__proto__` in every spelling.
- [ ] Reader proofs from the corpus, including both sharing directions and the
      byte-path vectors (BOM, invalid UTF-8) the corpus assigns to stage 4.
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
- [self-contained tokenizer](../../json/todo/self-contained-tokenizer.md) — stage 3; 3b exports the scanners this reuses.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — the shared serializer walker and its four seams. Stage 4 is its second consumer.
- [663](../../../djs/todo/663-json-djs-tree-type.md) — the tree type; interacts with the optional index signature in §1.
