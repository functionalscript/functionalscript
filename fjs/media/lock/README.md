# `vnd.fjs.lock`

A `lock` BLOB is a lock map stored on its own, so several revisions can point
at one agreed resolution instead of each carrying a copy.

[`vnd.fjs.revision`](../revision/)'s `lock` is an **inline** map, and that is
the right default — a revision stays interpretable in isolation. But a lock map
holds one entry per resolved dependency, and nested scopes multiply that, so a
new revision whose bindings are unchanged (the ordinary case: the source moved,
the dependencies did not) re-serializes the whole map into a new blob. CAS
deduplicates whole blobs, not fragments, so the map is stored again per step.
Across subjects the same repetition appears sideways: several components
resolving the same dependency set each carry their own copy, and keeping them
equal is a convention nothing checks.

This dialect is that map, addressed once.

```ts
import { lockSchema, dialect, mediaType, validate, decodeText, encodeText } from './module.f.mjs'
```

## Shape

```ts
export const lockSchema = {
    dialect: 'vnd.fjs.lock',
    lock,
} as const
```

| Field     | Type                                                | Meaning                                              |
|-----------|-----------------------------------------------------|------------------------------------------------------|
| `dialect` | `'vnd.fjs.lock'`                                    | Format tag — the media type is derived from it.       |
| `lock`    | `{ [subject: string]?: hash \| LockMap }`           | The bindings — [`vnd.fjs.revision`](../revision/README.md#lock-maps)'s map, unchanged. |

`lock` is **imported** from [`fjs/media/revision`](../revision/module.f.mjs),
not restated: one recursive schema, one semantic hash check
(`lockMapError`), one canonical serialization. So the shared form admits
exactly the maps the inline form does, to the same depth, with the same value
domain and the same rejections — and a map's bytes under `lock` are identical
whichever blob holds it, which `proof.f.mjs` pins directly rather than leaving
to review.

Everything the [Lock maps](../revision/README.md#lock-maps) section says
applies here verbatim: a direct value selects immutable content, a nested map
scopes further bindings, and the format defines no overlay, inheritance, or
precedence rule for either. It **records** bindings; a resolver interprets
them.

## Not a step

There is no `subject`, `parents`, `generation`, or `archived`. This dialect is
a **value**, not a step in anything's evolution: a lock blob says what a set of
dependencies resolves to, and says it about no one in particular.

History for lock content, when someone wants it, is an **ordinary revision**
whose `subject` identifies the lock and whose `snapshot` is one of these blobs.
That is the whole point of keeping the blob history-free — no second history
mechanism appears, and `revision` stays the only one. Ancestry, heads, merges,
and archiving are then exactly what they already are, with no rules of their
own to learn.

`lock` is **required**, and may be `{}`. An absent map and an empty one would
otherwise be two spellings of one blob, and a blob whose only purpose is to
hold a map has nothing to say when it does not hold one. (The inline field is
optional for the opposite reason: there, absence means *this revision recorded
no bindings*, which is a real thing to say about a revision and is distinct
from recording none.)

## Composition

A lock blob does not reference further lock blobs: `lock` is a map, never a
hash, so following a reference always terminates in one step.

It could be made to compose — entries and references alike select content
hashes, and a hash-consistent store cannot contain a cycle among them, so it
would terminate for the same reason the format's acyclicity argument holds
elsewhere. It is not worth it. A hash *inside* a map already means "this
dependency's content", so the same string in the same position would have to
mean either that or "more bindings, over there" depending on what the store
happens to hold under it — a reader could not tell which without fetching, and
a fetch that returns something else changes the map's meaning. Refusing
composition keeps every position unambiguous at the cost of one indirection
nobody has asked for.

That reasoning is about the *value position*, and does not reach a separate
top-level field naming lock blobs to layer over — nothing ambiguous is written
there. Inheritance in that form is proposed in
[lock-inheritance](./todo/lock-inheritance.md), which would also have to
settle whether defining a precedence order is format business at all.

## Canonical serialization

Identical to the revision dialect's: sort every object's property names
lexicographically, recursively, comparing names as strings (`"10"` precedes
`"2"`). Both dialects encode through the same `stringify(sort)`, so blobs
differing only in whitespace or property order converge to one CAS address —
which is the whole point of sharing one.

## Media type and dialect tag

The tag is `vnd.fjs.lock` and the media type is derived mechanically:
`application/` + dialect + `+json`.

```
dialect:   vnd.fjs.lock
mediaType: application/vnd.fjs.lock+json
```

This module contributes `lockDialect` — `lockSchema` plus its hash check as the
refinement — to [`fjs/media`](../)'s `detect`, so a blob is classified as
`application/vnd.fjs.lock+json` exactly when `decodeText` would accept it.
`fjs/mcp` registers it alongside `revisionDialect`, so `cas_get` reports either
under its own media type. See
[the revision spec](../revision/README.md#media-type-and-dialect-tag) for the
convention and the versioning rule, which this dialect follows unchanged.

The two dialects never claim each other's blobs: each schema matches its own
`dialect` literal, so structural validation alone rejects the other's content —
a revision carrying an inline `lock` is a revision, not a lock blob.

## Validation boundary

This module is pure format with no store access, so it validates that every
direct value at every depth is a cbase32 hash and stops there. Whether a
referenced blob exists, whether a revision's shared-lock reference points at
one of these blobs at all, and what any of it resolves to, are a resolver's
concerns — the same contract `snapshot` has in the revision dialect.

## Out of scope (this module)

- A dependency-resolution algorithm. Inherited wholesale from the inline form:
  the format records bindings; precedence, inheritance, and conflict rules are
  a resolver's.
- Composing lock blobs out of other lock blobs — see
  [Composition](#composition) for why not.
- Anything to do with history. A lock blob has none of its own; use a revision.

## Related

- [fjs/media/revision/README.md](../revision/README.md) — the inline `lock`
  map, and [Shared lock references](../revision/README.md#shared-lock-references),
  the field that points here
- [fjs/media/README](../) — dialect-tagged JSON detection
- [fjs/cas/evo/README.md](../../cas/evo/README.md) — `RevisionData`, which
  carries either lock form in both directions
