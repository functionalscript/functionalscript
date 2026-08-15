## Lock inheritance: a lock blob layered over its parents

**Priority:** P4
**Status:** open

### Problem

A [`vnd.fjs.lock`](../README.md) blob is a complete map. Two lock blobs that
agree about ninety dependencies and differ about one still share nothing: each
states all ninety-one bindings, and CAS deduplicates whole blobs, not
fragments. The shared-lock reference solved the *revision*-side repetition —
many revisions, one lock blob — and left the lock-side repetition untouched:
many near-identical locks, no common base.

That is the ordinary shape of a dependency set. A base resolution plus a small
per-component override is what every real lockfile ecosystem ends up needing,
and today the only way to express it is to copy the base and edit it, with
nothing in the format recording that the two are related, let alone how.

### Proposal

An optional `parent` field on `vnd.fjs.lock`, listing lock blobs this one
layers over:

```json
{
  "dialect": "vnd.fjs.lock",
  "parent": ["<hash-of-A>", "<hash-of-B>"],
  "lock": { "D": "<hash>" }
}
```

**Precedence.** Parents are applied **right to left**, then the blob's own
`lock` is applied last. So the rightmost parent is the weakest layer, each
entry to its left overrides it, and the blob's own map overrides them all:

```
effective = apply(own, apply(A, apply(B, {})))     // for parent: [A, B]
precedence: own  >  A  >  B
```

Leftmost-wins matches the convention `vnd.fjs.revision` already uses for
`parents`, where `parents[0]` is the mainline — the most significant entry
comes first in both.

**This is not the composition the README declined.** [Composition](../README.md#composition)
rejected a lock-blob hash appearing *inside* the map, in the position where a
dependency's content hash goes: a reader could not tell "this dependency's
content" from "more bindings, over there" without fetching, and a fetch that
returned the other kind would change the map's meaning. A separate top-level
`parent` field has no such ambiguity — nothing else is ever written there, and
the map's value domain is untouched. The README's stated reason does not reach
this design, and the section needs narrowing (not deleting) if this lands.

**The objection it does have to answer.** The format has refused, everywhere
and deliberately, to define overlay, replacement, inheritance, or lookup for
lock maps — flat or nested. This proposal defines precedence, in the format,
for the first time.

The argument that it may still belong: what is being defined is a *syntactic
fold over lock blobs*, not a dependency-resolution algorithm. It says how
several recorded maps combine into one recorded map, and says nothing about
which subject resolves to what, how a missing binding is discovered, what a
nested scope means to a resolver, or when a mutable head may be consulted —
every semantic the format still declines. In that reading it is closer to
canonical serialization (a normalization rule with one right answer) than to
resolution. **Decide this before designing a schema**; if the fold is judged
to be resolution after all, the whole feature belongs to resolvers and the
issue closes as declined.

### Open design points

- **Deep or shallow overlay.** The biggest semantic question, and it is
  unavoidable because values are `hash | LockMap`. Does `{"B": {"D": h1}}`
  over `{"B": {"C": h2}}` merge to `{"B": {"C": h2, "D": h1}}` or replace `B`
  wholesale? And what happens when a hash overlays a nested map at the same
  key, or the reverse — is that a type change, an override, or invalid?
  Shallow (whole-value replace) is the rule with no further questions
  attached; deep is what most people expect and reintroduces exactly the
  merge semantics the format has avoided.
- **Versioning: this field is fail-open.** rtti structs are open, so an older
  reader validates a blob carrying `parent`, sees only the local map, and
  concludes those are all the bindings — silently missing every inherited one
  while believing the resolution is complete. That is the trap the versioning
  rule exists to prevent, and it points at `vnd.fjs.lock2`. Before accepting
  that, look for a **fail-closed spelling** the way the revision reference
  found one ([Widening `lock` again](../../revision/README.md#widening-lock-again)):
  `lock` is the only required field, so an inheriting blob could instead
  express itself by giving `lock` a form an old record-validating reader
  rejects outright. That would keep the tag at the cost of a stranger shape.
  Neither is obviously right; the choice is the same trade — per-blob
  breakage versus per-dialect breakage — and it must be made explicitly.
- **Flattening is the definition.** The fold's result should itself be an
  ordinary lock map, so an inheriting chain and a hand-written flat blob that
  means the same thing serialize to identical bytes. That gives the feature a
  precise specification and a direct proof, and keeps flattened output a valid
  input to everything that exists today.
- **Diamonds and repeats.** A parent reachable by more than one path should be
  folded once, keyed by hash — otherwise a wide graph is re-walked
  exponentially for a result that cannot differ.
- **Termination and read amplification.** `parent` entries are content hashes,
  and a hash-consistent store cannot contain a cycle among them, so the fold
  terminates for the same reason the format's other acyclicity arguments hold.
  Depth, however, is unbounded: a reader must fetch the whole chain before it
  knows any binding at all. Whether the format caps depth, or leaves the cost
  to whoever builds the chain, is undecided.
- **`parent: []` versus absent.** The format already distinguishes an omitted
  `lock` from `{}`; the same question applies here and should be answered the
  same way rather than by accident.
- **Validation boundary, unchanged.** `fjs/media/lock` is pure format with no
  store access, so it can check that each `parent` entry is a cbase32 hash and
  nothing more — not that the blob exists, not that it is a lock blob. The
  fold itself therefore cannot live in this module; it belongs wherever a
  store is available, and this issue must say where.

### Consequences elsewhere

- [`vnd.fjs.revision`](../../revision/README.md#shared-lock-references) states
  that following a shared-lock reference "terminates in one step", which stops
  being true. That sentence, and the [Composition](../README.md#composition)
  section it cites, both need rewriting — a chain would terminate, but not in
  one step.
- [`fjs/cas/evo`](../../../cas/evo/README.md) records and canonicalizes lock
  references without following them. A `parent` list is more of the same —
  hashes to validate and re-spell, not to resolve — so evo should need no new
  concept, only the extra field. Worth confirming rather than assuming.

### Tasks

- [ ] Decide whether a layering fold is format business or resolver business
      (see the objection above). If resolver, close this issue as declined and
      record why.
- [ ] Decide deep versus shallow overlay, including the hash-over-map and
      map-over-hash cases.
- [ ] Decide the dialect question: whether a fail-closed spelling exists that
      keeps `vnd.fjs.lock`, or whether `parent` requires `vnd.fjs.lock2`.
- [ ] Specify the fold as a flattening to an ordinary lock map, with diamond
      deduplication by hash.
- [ ] Implement the field in `fjs/media/lock` (schema, hash validation of
      every `parent` entry, `README.md` spec, proofs), and place the fold in a
      store-aware module.
- [ ] Prove that an inheriting chain and the equivalent flat blob serialize
      identically, the way the inline/shared equality is already pinned.
- [ ] Update the `Composition` section and the revision spec's
      "terminates in one step" claim.

### Related

- [fjs/media/lock/README.md](../README.md) — the dialect this extends, and the
  `Composition` section whose reasoning this proposal argues does not apply
- [fjs/media/revision/README.md](../../revision/README.md) — the shared-lock
  reference, the `parents`-order convention this borrows, and the fail-open
  versioning rule the new field runs into
- [change-content-format](../../todo/change-content-format.md) — the same
  fail-open trap in a different field, and the dialect it forced
- [fjs/cas/evo/README.md](../../../cas/evo/README.md) — where lock references
  are validated and canonicalized without being followed
