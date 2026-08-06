## Serializable data form

**Priority:** P3
**Status:** open

### Problem

An rtti schema is a graph of thunks, and recursion is a self-referencing
function. A schema is therefore a *cyclic object graph* whose only node
identity is reference equality and which cannot be written down.

Two consequences, both live today:

1. **Any consumer that emits a finite artifact describing a schema crashes on a
   recursive one.** [`toJsonSchema`](../../../media/json/schema/module.f.ts) and
   [`printer`](../ts/module.f.ts) both follow every thunk eagerly and overflow
   the call stack. `toJsonSchema(unknown)` fails on the very schema that module
   defines — see
   [fjs/media/json/schema recursive-schema-defs](../../../media/json/schema/todo/recursive-schema-defs.md).
   `fjs/media/revision`'s `lock` field would be a second instance, and is
   currently typed `unknown` at the rtti level partly for that reason.
2. **Schema algebra has nowhere to live.** `or` is deliberately a lazy,
   allocation-free constructor doing no flattening, dedup, or subset analysis,
   because there is no representation on which that work is well defined.
   Equality, subset, and canonical ordering are undefined for the same reason:
   two `or(a, b)` calls produce two distinct, incomparable thunks.

Consumers that *check a value against a schema* do not need names to terminate:
`validate` and `parse` instantiate a container's item walker only after finding
the container non-empty, so laziness carries them through any cyclic schema.
The split is not about performance — it is computability. Emitting a finite
description of a cyclic graph requires names; checking one value against it does
not.

That is a statement about *termination*, not about safety. Those consumers have
their own depth problem — they spend a stack frame per level of the **value**,
so a deeply nested input against a recursive schema throws rather than returning
a `Result`. Different bug, different fix (an explicit work list), tracked in
[recursive-validation-stack-safety](./recursive-validation-stack-safety.md).
Neither issue blocks the other.

### Proposal

Two forms with one job each, and `toData` as the single bridge — the
architecture [`fjs/bnf`](../../../bnf/data/) already uses.

1. **Thunk form** — what users construct. Cheap, lazy, ergonomic; recursion by
   self-reference. The construction surface and nothing more. Unchanged.
2. **Data form** — function-free, flat, serializable. Every node has a stable
   name, and every reference — including every cycle — is a name into one map.

`toData` runs once, when a consumer actually needs it, so schemas that are built
but never consumed pay nothing. `validate` and `parse` keep their thunk-direct
implementations; a data-driven variant may be added later and coexist.

**The reference spine is settled: copy [`fjs/bnf/data`](../../../bnf/data/module.f.ts).**
Its `toDataAdd` already solves exactly this problem for a different ADT:

```ts
const id = find(map)(fr)                  // reference identity: v === fr
if (id !== undefined) { return [map, {}, id] }
                                          // ^ back edge: emit a reference, do not recurse
const map1 = { ...map, [id]: fr }         // register BEFORE recursing — this is what breaks the cycle
const [map2, set, rule] = newRule(map1)
```

plus `newName` for `.name`-derived identifiers with numeric de-duplication.
Reimplementing this per consumer is the outcome to avoid: the `$defs` issue
above and `printer` would otherwise each grow their own copy.

**Naming works out in rtti, for a non-obvious reason.** BNF grammars are named
function declarations, so `fr.name` is meaningful there. rtti nodes mostly come
from combinators, and measured, `lock.name` is `"lock"` while
`or(string, string).name` and `array(string).name` are both `""`. That is fine:
a cycle in an rtti schema **can only close through a named binding** —
`or(hash, lock)` needs `lock` in scope, and there is no other way to write a
self-referential schema. So every node that needs a name has one, and every
anonymous node is acyclic and can be inlined or given a generated name.

### Open questions

- **The node payload shape is deliberately not settled here.** The minimum that
  unblocks the two crashing consumers is a payload mirroring today's `Type` ADT
  one for one. Treat any such first payload as **provisional**: the canonical,
  set-theoretic shape is [schema-algebra](./schema-algebra.md)'s subject, and it
  may replace the payload without touching the spine. That the two are separable
  is what `fjs/bnf/data` demonstrates —
  `Rule = Variant | Sequence | TerminalRange` is a payload choice the spine
  knows nothing about.
- **Keys: names or indices?** `StringMap<Node>` (BNF's choice) survives a
  serialization round trip readably and hands `$defs` and TypeScript aliases
  their identifiers directly; `readonly Node[]` is more compact and trivially
  canonical. Pick one before consumers depend on the spelling.
- **How stable must `toData`'s output be?** BNF dedups by reference identity
  only, so two structurally identical subtrees built separately become two
  rules. Whether structurally identical inputs must converge to one node is a
  canonicalization question and probably belongs to
  [schema-algebra](./schema-algebra.md).
- **Must the data form represent function-valued schemas at all?** See
  [668-rtti-function-types](../../todo/668-rtti-function-types.md) — extern
  function schemas may have to stay outside a function-free core form.

### Tasks

- [ ] Decide name-keyed vs index-keyed references.
- [ ] Define a provisional node payload mirroring today's `Type` ADT, marked as
      replaceable by [schema-algebra](./schema-algebra.md).
- [ ] Implement `toData` over `visit`, reusing `fjs/bnf/data`'s register-before-
      recurse structure; extract the shared part rather than copying it if the
      two turn out to differ only in payload.
- [ ] Prove cycles terminate, including a self-referential schema and a mutually
      recursive pair.
- [ ] Prove naming: a named `const` keeps its name; anonymous nodes get stable
      generated names; collisions are de-duplicated.
- [ ] Re-implement `toJsonSchema` and `printer` over the data form and delete
      their acyclic-only caveats.

### Related

- [fjs/bnf/data](../../../bnf/data/module.f.ts) — the same two-form architecture,
  already built and proven; `toDataAdd` is the algorithm to reuse
- [schema-algebra](./schema-algebra.md) — the canonical node shape and the set
  operations on it; split out of this issue because it is open research and this
  spine is not
- [fjs/media/json/schema recursive-schema-defs](../../../media/json/schema/todo/recursive-schema-defs.md)
  — the first blocked consumer, with a live crash
- [fjs/types/rtti/ts](../ts/module.f.ts) — `printer`, the second blocked
  consumer, with the same eager-walk limitation
- [fjs/types/rtti/common](../common/module.f.ts) — `visit`, the shared `Type`-ADT
  walker `toData` should be built on
- [recursive-validation-stack-safety](./recursive-validation-stack-safety.md)
  — the other depth problem in this ADT: validating a deep *value*, rather than
  emitting a cyclic *schema*. Independent of this issue, and the reason
  `fjs/media/revision`'s `lock` has no rtti schema today
- [662](../../todo/662.md), [172](../../todo/172.md) — both anticipate this as
  the next `Type`-ADT consumer
