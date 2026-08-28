# `vnd.fjs.revision`

A `revision` BLOB is one step in the evolution of a mutable object on top of
an immutable content-addressable store ([fjs/cas](../../cas/)). CAS blobs
are addressed by content hash, so "the same object, but updated" is
unavoidably a new hash with no address in common with the old one. A
`revision` gives a chain — really a DAG, so concurrent edits can merge — of
updates to one logical mutable object a shared shape, without any mutable
pointer anywhere in the store itself.

```ts
import { revisionSchema, dialect, mediaType, validate, decodeText, encodeText } from './module.f.mjs'
```

## Shape

```ts
export const revisionSchema = {
    dialect: 'vnd.fjs.revision',
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: or(option, true),
    lock: or(option, lockField),
} as const

export const lock = () => ['record', lockValue] as const
const lockValue = () => ['or', string, lock] as const
export const lockField = () => ['or', hash, lock] as const
```

| Field        | Type                    | Meaning                                                              |
|--------------|-------------------------|------------------------------------------------------------------------|
| `dialect`    | `'vnd.fjs.revision'`    | Format tag — see [Media type](#media-type-and-dialect-tag) below.      |
| `subject`    | `string`                | Identity of the mutable object this revision revises.                  |
| `parents`    | `hash[]`                | Parent revision BLOBs, mainline (first-parent) first — see below. `[]` means this is the first revision. |
| `snapshot`   | `hash`                  | Complete materialized content of this revision. Always stated explicitly. |
| `generation` | `number`                | Generation number — `0` for the first revision, else `1 + max(parent.generation)` for conforming writers. |
| `archived`   | `true` (optional)       | Marks the mutable object as archived/inactive.                         |
| `lock`       | `hash \| { [subject: string]?: hash \| LockMap }` (optional) | Resolver input binding dependency subjects to immutable content, optionally scoped — inline as a map (see [Lock maps](#lock-maps)) or as the hash of a `vnd.fjs.lock` blob holding one (see [Shared lock references](#shared-lock-references)). |

`hash` is a cbase32 native CAS address ([fjs/basen/cbase32](../../basen/cbase32/)).
It is the only snapshot-reference type this dialect accepts: `parents` and
`snapshot` always validate as hashes — never `https://` bridge URLs or any
other location-addressed reference form. `subject` is a pure identity string,
never a snapshot reference, so it is never validated as a hash — any string is
a valid `subject`.

## Lock maps

Held inline, `lock` is an optional open map from subject to either a **direct
hash** or a **nested lock map**, to any depth. (The field also accepts a hash
in place of the whole map — see
[Shared lock references](#shared-lock-references) — which is a different thing
from the hashes described here, and the only position where it is.) Each direct
value selects immutable content, like `snapshot`; it is not a revision-object
hash. Missing bindings have no format-defined fallback or inheritance
behavior: dependency discovery,
precedence, conflict handling, ancestry inspection, and mutable-head fallback
belong to resolvers. An omitted lock means no bindings were recorded, while an
explicit empty lock remains distinct as `{}`. A binding for the revision's own
subject is structurally valid.

A flat map is the normal representation. Nest only when one flat binding
cannot express the available scoped choices — the incompatible diamond being
the case that motivates nesting at all:

```text
A -> B        B -> D(v1)
A -> C        C -> D(v2)
```

```json
{
  "B": { "B": "snapshot-hash-of-B", "D": "snapshot-hash-of-D-v1" },
  "C": { "C": "snapshot-hash-of-C", "D": "snapshot-hash-of-D-v2" }
}
```

The format **records** that information and stops there. It defines no
overlay, replacement, inheritance, or lookup rule for a nested map, exactly as
it defines none for a flat one — a nested map may be sparse and may omit the
subject it appears under. What a scope means, and which of two enclosing
bindings wins, is a resolver's decision; two resolvers reading the same
revision may legitimately answer differently, and the blob has not lost
anything either of them needs.

Because entries select *content* hashes and never revisions containing further
lock maps, a lock map cannot introduce a revision-hash cycle: a logical
dependency cycle between subjects is expressible without one.

Nesting only widens the value domain, so every flat map remains valid and
means what it always did. It stays inside this dialect rather than becoming
`vnd.fjs.revision2` — see [Widening `lock`](#widening-lock) below.

## Shared lock references

In place of the map, `lock` may be a **hash naming a
[`vnd.fjs.lock`](../lock/) blob** that holds one. A revision whose bindings are
unchanged from its parent's then re-serializes one hash instead of the whole
map, and several subjects resolving the same dependency set can point at one
agreed resolution rather than each carrying a copy that nothing checks stays
equal.

```json
{ "dialect": "vnd.fjs.revision", "subject": "app", "parents": [], "snapshot": "…", "generation": 0, "lock": "…" }
```

Only the top level admits a hash. A string *inside* a map is a dependency's
content, exactly as before; a string *as* the field is where the whole map
lives. Nothing is ambiguous, because the two are never in the same position.

**The field is validated as a cbase32 hash and nothing more.** This module is
pure format with no store access, so it does not check that the blob exists, or
that what is under it is a `vnd.fjs.lock` at all — the same contract `snapshot`
already has. Following the reference is a resolver's job, and a resolver keeps
every semantic the format still declines to define.

**A revision states one or the other, never both.** The two forms are
alternatives in one field, so "an inline map *and* a reference" cannot be
written down, and the format therefore defines no precedence between them —
consistent with its refusal to define overlay or inheritance for nested maps.
Nor is a chain possible: a lock blob's own `lock` is a map, never a hash
([Composition](../lock/README.md#composition)), so following a reference
terminates in one step.

**Interpretability in isolation is unaffected in the sense the rule means it.**
`snapshot` and `generation` remain required, so materializing a revision's
content and ordering it still needs nothing but the blob. A reference is a
reference, like `snapshot` and `parents` — dereferencing one is fetching, not
inference: no algorithm, no ancestry walk, no third case. What a resolver had
to fetch to *use* the bindings, it fetched already.

The reference is spelled as a **widening of the existing field** rather than as
a new `lockRef` sibling, and that choice is a compatibility one, not a
stylistic one — see
[Widening `lock` again](#widening-lock-again) once the versioning rule below
is in view.

## Canonical serialization

Conforming writers serialize revision JSON canonically by sorting every
object's property names lexicographically. Sorting is recursive, so it applies
to the top-level revision, `lock` at every depth, and future nested JSON
objects; arrays retain their declared order. Names are compared as strings
(`"10"` precedes `"2"`).
Consequently parsed revisions that differ only in whitespace, escape spelling,
or property construction order converge to identical bytes and one CAS address.
Existing non-canonical blobs remain valid input and normalize when rewritten.

Because rtti struct schemas can't express string-content refinements, `hash`
is `string` at the schema level and `generation` is `number`; cbase32
decodability (and the rejection of non-cbase32 strings such as `https://`
URLs), plus `generation` being a **non-negative safe integer** (`≤ 2 ** 53 −
1`, so `1 + max(...)` stays exact), are enforced by `isHash` / `validate`,
layered on top of the structural schema.

## Interpretable in isolation

Every field a revision needs is present in the revision itself: `snapshot` and
`generation` are **required**, so no field's meaning ever depends on fetching
another blob. A reader can materialize a revision's content (`snapshot`) and
order it (`generation`) from the blob alone — there is no inheritance to
resolve, no ancestry to walk, no third-case algorithm. This is the property
every future field proposal is measured against — including a
[shared lock reference](#shared-lock-references), which passes it because
dereferencing a hash is fetching, not inference, exactly as it is for
`snapshot` and `parents`.

The rule that produces it: **a field whose absent value would have to be
*derived from other data* is required; optional is reserved for fields whose
absent value is a constant default.** `snapshot` and `generation` are required
because their absence would force inference (a resolution algorithm and an
ancestry walk, respectively). `archived` is the documented boundary of the
rule and stays **optional**: its absence is the constant `false`, derivable
from nothing, so the `or(option, true)` presence-flag idiom is exactly right —
forcing `archived: false` onto every blob would be pure noise.

Inference has not disappeared; it moved to the write boundary. The `evo_add`
API ([fjs/cas/evo](../../cas/evo/)) keeps its input conveniences — infer
`subject` from a single parent, compute `generation`, resolve an absent input
`snapshot` (zero parents → `subject` as the reference, one parent → the
parent's snapshot) — and writes every field explicitly. APIs infer; the stored
record never does.

## Media type and dialect tag

`dialect` is a self-describing format tag: in a generic CAS, a blob is just
bytes under a hash, so without a discriminant a reader can only recognize a
revision by guessing from its shape, which collides with any other format
that happens to have `subject`/`parents` fields. The tag doubles as the
schema-dispatch key. Its value is a short dialect name in the RFC 6838
vendor-tree style; the media type the blob is served with is derived
mechanically — `application/` + dialect + `+json` — because the
`application/` top level and the RFC 6839 `+json` structured-syntax suffix
are already implied by the file being JSON:

```
dialect:   vnd.fjs.revision
mediaType: application/vnd.fjs.revision+json
```

No IANA registration is required for the vendor tree; the string is stable, and
it is validated by the schema itself since the literal is part of the schema.

**Recognizing a blob of unknown provenance.** `fjs/media`'s `detect` is told
which dialects to recognize rather than knowing any itself; this module
contributes `revisionDialect` — `revisionSchema` plus `checkReferences` as its
refinement — so a blob is classified as `application/vnd.fjs.revision+json`
exactly when `decodeText` would accept it, and the media type is derived from
the schema's own `dialect` literal by the rule above rather than named a second
time. Any format following this convention registers the same way, with
`dialectEntry`; a caller that already knows what it is validating needs none of
this and calls `decodeText` / `validate` directly.

**Versioning rule:** additive, compatible changes keep the tag — rtti struct
validation accepts undeclared keys by design, so a blob with extra fields
still validates against this schema, and that is the intended
forward-compatibility path. An **incompatible** change must not reuse the
tag: it introduces a new dialect (e.g. `vnd.fjs.revision2`), so readers of the
old format never validate — and never silently misread — a blob of the new
one. This is why incremental diffs are not a field here: an optional
`changes` field would be schema-additive but semantically breaking (a v1
reader would still validate such a blob and materialize the base, silently
ignoring the changes). Incremental changes are a future separate dialect,
`vnd.fjs.change`, served as `application/vnd.fjs.change+json`.

### Widening `lock`

Allowing a nested map where only a hash string used to be legal is neither of
those cases, and it keeps the tag. The versioning rule forbids reusing a tag
when an old reader would still validate a new blob and **misread** it; a
reader that validates `lock` as a map of strings rejects a nested map outright
instead. So the two failure modes on offer are:

- **keep the tag** — a nested-lock revision is unreadable to old readers, and
  every flat-lock revision (the normal representation) keeps working;
- **new tag** — *every* revision becomes unreadable to old readers, including
  the flat ones, to announce a capability most blobs never use.

The dialect tag is per blob, not per field, so the second option cannot be
scoped to the revisions that actually nest. Widening keeps the tag, and an
older reader's rejection of a nested map is the intended, fail-closed outcome
rather than a compatibility break to route around.

**Relaxing a required field is also incompatible.** Making a currently
required field (`snapshot`, `generation`) optional again is allowed, but only
together with a *specified inference algorithm* for the absent value — and,
per the versioning rule above, under a **new dialect**, since a reader of this
dialect rejects a blob missing a required field. The relaxation and its
algorithm are one decision. (This was possible in-place for the current
requirement only because the format is still being designed and no
`vnd.fjs.revision` records have ever been stored — that window closes the
moment the first revision is written.)

### Widening `lock` again

[Shared lock references](#shared-lock-references) is the same decision a second
time, and it is why the reference is a widening of `lock` rather than a
`lockRef` sibling.

A sibling field would be schema-additive — `revisionSchema` says `open`, so an
older reader would still validate the blob — and it would then read `lock` as absent:
*no bindings were recorded*, the field's documented constant meaning. It would
resolve dependencies through mutable heads and believe the result reproducible.
That is precisely the silent misread this rule exists to prevent, and the same
trap that keeps incremental diffs out of this dialect. A `lockRef` field would
therefore have required `vnd.fjs.revision2`, making *every* revision unreadable
to older readers — including the ones that never share a lock.

Widening the field fails **closed** instead, exactly as nesting did: a reader
that validates `lock` as a map rejects a string outright rather than misreading
it. Only revisions that actually reference a shared lock are unreadable to an
older reader, and the tag stays `vnd.fjs.revision`.

The cost is one field carrying both "the bindings" and "where the bindings
are", which reads slightly worse in the schema. It is worth it twice over: it
trades a per-dialect compatibility cost for a per-blob one, and it makes
carrying an inline map and a reference at once unstatable rather than merely
discouraged — so the format has no precedence rule to define, just as it has
none for nested maps.

## Tagged-JSON detection

Detection is semantic, not syntactic: [fjs/media](../../media/) parses the
JSON and validates the parsed value against this schema — any JSON that
satisfies it is a revision, regardless of key order, whitespace, or any other
serialization detail. There is no byte-level shortcut (no assumption about
key order, no `{"dialect":` prefix). JSON that fails to parse, or parses but
doesn't validate against this schema (including a wrong `dialect` value),
falls through to the ordinary detector.

The one practical limit is size: schema validation requires the blob to
already be a buffered `Vec` (`fjs/types/bit_vec`), so it is attempted only on
a size-bounded path such as the existing 128 KiB inline-content cap. Larger
blobs fall back to the existing streaming detector, so metadata-only reads
stay size-independent. That is an implementation limit of today's buffering
parser, not part of the format.

The embedded tag is a **convention for new JSON media types designed in
FunctionalScript** — a good default, not a requirement, and not universal:
[fjs/media/](../) also hosts formats from other vendors (`text/html`, plain
`application/json`), and FS's JavaScript-subset dialects cannot carry an
embedded JSON tag at all, so they keep the ordinary
[fjs/media/type](../type/) detection path and surface their dialect name out
of band (see
[fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
for the dialect naming rule and fall-back chains). The key is spelled
`dialect` — one vocabulary for both the embedded tag and the out-of-band
field — and deliberately not `mimeType` (a common response-envelope field
name: an envelope stored back into CAS would carry a colliding key, and the
value here is not a MIME type anyway), `contentType` (echoes the HTTP header,
and `content` already collides in many envelopes), or `mediaType` (a
near-synonym of `mimeType`; serving both side by side would invite exactly
the confusion the vocabulary split prevents).

## Heads, merges, and archiving

`subject` gives every revision of the same mutable object a common anchor:
the head(s) are whatever revision(s) reference `subject` and are not listed
as a parent by another revision *of the same `subject`* — a revision of a
*different* subject that happens to reference the same hash must not demote
a head. Concurrent heads are resolved the same way as in Git: a merge tool
creates a new revision listing the conflicting revisions as `parents`. The
format only records conflict resolution; it never resolves conflicts itself,
and CAS synchronization never needs to care — a subject can legitimately have
many heads in a store at any time.

Parent *order* is significant: `parents[0]` is the **mainline** parent — the
branch this revision landed on, in the sense of Git's first-parent link. A
merge tool merging branch B into branch A lists A's head first, then B's.
Walking only first parents from a head therefore yields that head's mainline
history, with every later `parents` entry marking a branch that merged in —
this is the walk the planned history API performs
([fjs/cas/evo/todo/subject-history.md](../../cas/evo/todo/subject-history.md)).
Reordering `parents` changes the meaning of a revision (which branch the
merge landed on), not just its serialization.

`generation`'s *correctness* is existence and integer-ness only: a blob is a
revision iff it carries a `generation` that is a non-negative safe integer.
Equality with `1 + max(parents' generations)` (or `0` for a root) is what a
conforming writer produces — evo's `add` always does — but it is **observed,
not enforced**. A deviation is not an invalid blob; it is a *signal* that
someone reset the history/clock — e.g. a revision starting a new epoch, such
as a new subject that still lists its origin as `parents` to show how it was
formed. Consumers may surface the discontinuity (an epoch-reset indicator);
they must not reject the blob for it. Ordering by `generation` is therefore
reliable within an epoch, and the cheap one-level comparison against parents
is the epoch-boundary detector. The evo layer does not *construct* such a
revision — `add` requires every parent to share the revision's subject — but
that is its own decision, not the format's; see the cross-subject-parents
section of [fjs/cas/evo/README.md](../../cas/evo/README.md).

`archived` marks a mutable object as no longer worked on (e.g. a finished
task); its blobs can be deleted from a local CAS after a backup. It follows
the existing `or(option, true)` idiom (a presence-only flag) rather than
`or(option, boolean)`.

## Out of scope (this module)

- Store-touching evolution operations — head resolution, materialization,
  per-object reverse indexes — are a separate, deferred concern. This module
  is the pure format and its schema/detection only.
- The incremental-change dialect `vnd.fjs.change` (event log, likely
  CRDT-based) and how it links to revisions — a future, separate dialect
  ([fjs/media change-content-format](../todo/change-content-format.md)).
- Snapshot-reference forms beyond cbase32 hashes, and the syntax of a
  content-addressed revision reference (e.g. `{hash}.{generation}.{hash}` —
  `hash.generation` alone does not pin a version across branches; undefined
  for now, only hashes are used). Subject identity strings are already
  unconstrained, since `subject` is never a snapshot reference.
- A dependency-resolution algorithm. The format records bindings; precedence,
  inheritance, and conflict rules are a resolver's, and are deliberately
  absent here (see [Lock maps](#lock-maps)).
- Digital signatures for filtering changes from unknown users — a future,
  separate spec. Further out, a `{public-key}/{name}.{generation}` reference
  form, where the key's owner defines what `{name}` means: anchoring the
  identifier in a signer ties format identity to the web of trust
  ([todo/plan/vision.md](../../../todo/plan/vision.md)'s `~/Alice/...`
  relative-path model) and says whose evolution of `{name}` a blob follows.
