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
work that route owed is gone with it. What remains here is the **byte path**
(`tryParseBytes`, §Layout) and the reader's proofs over
[the corpus](../../../../spec/datajs/vectors/README.md), which has landed — the
reader's own proof is derived from the specification by hand today.

**The writer is [`serializer.md`](./serializer.md).** It was split out of this
file, which keeps what both roles share — the value domain, the module's public
API, and the grammar decision — and carries the reader's remaining work. Stage 4
is the two files together.

### Problem

`fjs/media/datajs` is stage 4 of
[`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md)
and the deliverable EDAG is waiting for: a reader and a writer for the format
[`spec/datajs/README.md`](../../../../spec/datajs/README.md) specifies. Both
exist now — the reader over the grammar, the writer in
[`serializer.md`](./serializer.md) — and what this file carries is what the
reader still owes.

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
    serializer/       module.f.mjs, proof.f.mjs, types.ts — landed; `trySerialize`, `tryStringify` — [`serializer.md`](./serializer.md)
```

There is no `tokenizer/`: the reader is the grammar (§3).

**Every entry point is fallible, and the names say so.** A caller may
legitimately hand a reader invalid text or a serializer a value outside the
data model, so all of them are `try*` returning `Result` — the writer's two
are specified in [`serializer.md`](./serializer.md):

```ts
export const tryParseBytes: (bytes: List<U8>) => Result<Unknown, string>
export const tryParse:      (text: string)    => Result<Unknown, string>
export const trySerialize:  (value: unknown)  => Result<List<string>, string>
export const tryStringify:  (value: unknown)  => Result<string, string>
```

There is no `tryNormalize` beside them: the writer that landed **is** the
normalized one, so the name waits for a second writer to tell apart from —
[`serializer.md`](./serializer.md#layout-and-api) is where that is decided
and why.

**The byte path is not a convenience, it is a conformance obligation.** Two
document rules cannot be reached from a code-unit array at all — a document has
**no BOM**, and a document **is UTF-8** — and
[the corpus](../../../../spec/datajs/vectors/README.md) carries their
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

Why the writer's two are shaped that way — chunks and their `concat`,
`unknown` in, and no `sort` seam, because observable key order is part of the
value and not a caller's to choose — is
[`serializer.md`](./serializer.md#layout-and-api), which also says why
normalized form is not a third.

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
  read it through `entries` either — see
  [`serializer.md`](./serializer.md) §1: `Object.entries` invokes a getter
  while collecting its value, which is the effect that file rejects. **Own property
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
  four permitted characters are JSON's, and they are the whole rule: outside a
  string literal a character is whitespace or part of a token, and one that is
  neither is **refused**. Derive what is refused from that rather than from a
  list: everything outside a token is, `@` as much as U+2028, so the list is the
  input alphabet minus the tokens — finite, since the input is code units, and
  no more worth writing than the alphabet itself. The 21 worth naming are the delta — the characters
  ECMAScript treats as whitespace and DataJS does not — and they are enumerated
  once, in
  [the corpus's reject set](../../../../spec/datajs/vectors/reject/data.f.mjs),
  because each owes a vector. Every *normative* list of them written by hand
  here has been short, this plan's included, which is why the rule states what
  it accepts.

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

#### 4. Serializer, and 5. normalized form

Both are [`serializer.md`](./serializer.md), which holds the two passes, the
out-of-model rejections and their descriptor-first order, the hoisting and
naming rules, and normalized form's table. Nothing of either is restated here.

#### 6. Proofs

The proof source is the corpus,
[`spec/datajs/vectors`](../../../../spec/datajs/vectors/README.md), which is why
the stage plan put 1b before this issue: landing stage 4 first would have meant
writing its proofs twice. Its README is the schema and the rules the sets are
derived by, so a proof reads the sets and asserts nothing about how they were
chosen.

Proofs are **per role** — reader, serializer, normalized serializer — because
the spec judges them independently and this module provides all three. The
reader's two sets, `accept` and `reject`, are this file's; the writer's three —
`serializer-accept`, `graph-equivalence` and `normalize` — are
[`serializer.md`](./serializer.md) §4.

### Tasks

- [x] **First: settle whether the reader is the grammar or the token machine**
      (§3). The grammar; the token machine is retired for this format.
- [x] `fjs/media/datajs/types.ts` and `README.md`.
- [x] Reader: `fjs/ebnf/lib/datajs` composed with `eof`, over UTF-16 code
      units, folded to nodes; the statement layer with its environment,
      bound-once and declare-before-use; the key rule on the decoded value.
- [x] Reader proofs derived from the specification by hand, both sharing
      directions included.
- [ ] The byte path, `tryParseBytes`, with the BOM and invalid-UTF-8 vectors the
      corpus assigns to stage 4. The reader's proofs over the corpus are done —
      [`fjs/media/datajs/vectors/proof.f.mjs`](../vectors/proof.f.mjs) reads
      every accept document to the graph its vector asserts and refuses every
      reject one — but they reach the byte documents by decoding with
      `fjs/text/utf8` and reading the units, so the two rules only bytes can
      break are pinned at the wrong layer until this lands and the set is rerun
      through it.
- [ ] The writer, in [`serializer.md`](./serializer.md) — including
      `module.f.mjs`, the public API of §Layout, which waits for something
      beyond the reader to hold.
- [ ] Delete this file in the PR that finishes the reader — but not before the
      shared material [`serializer.md`](./serializer.md) reads from it, the
      public API of §Layout and the value domain of §1, has moved into that
      file or into [the module's README](../README.md). Deleting it first
      would leave the writer's issue pointing at nothing and the API contract
      with no owner. Stage 4 is done when both files go.

### Related

- [`serializer.md`](./serializer.md) — the writer, split out of this file. Stage 4 is the two together.
- [`todo/parser-serializer-restructure.md`](../../../../todo/parser-serializer-restructure.md) — the coordinating plan; this is its stage 4.
- [`spec/datajs/README.md`](../../../../spec/datajs/README.md) — normative. This issue implements it.
- [`spec/datajs/vectors`](../../../../spec/datajs/vectors/README.md) — the conformance corpus, landed as stage 1b. The proof source, and the schema for every set this issue's proofs read.
- [JSON's reader](../../json/todo/self-contained-tokenizer.md) — stage 3, open with its error shapes undecided. Over a grammar the reuse is of rules and of the `string` mapping, which [`fjs/ebnf/lib/datajs`](../../../ebnf/lib/datajs/module.f.mjs) and [`../parser`](../parser/module.f.mjs) do by import.
- [157](../../../djs/todo/157-json-djs-shared-value-machine.md) — the shared serializer walker and its four seams. Stage 4 is its second consumer.
- [663](../../../djs/todo/663-json-djs-tree-type.md) — the tree type; interacts with the optional index signature in §1.
