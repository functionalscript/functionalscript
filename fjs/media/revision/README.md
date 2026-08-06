# `vnd.fjs.revision`

A `revision` BLOB is one step in the evolution of a mutable object on top of
an immutable content-addressable store ([fjs/cas](../../cas/)). CAS blobs
are addressed by content hash, so "the same object, but updated" is
unavoidably a new hash with no address in common with the old one. A
`revision` gives a chain — really a DAG, so concurrent edits can merge — of
updates to one logical mutable object a shared shape, without any mutable
pointer anywhere in the store itself.

```ts
import { revisionSchema, dialect, mediaType, validate, decodeText } from './module.f.ts'
```

## Shape

```ts
export const lock = () => ['record', or(hash, lock)] as const

export const revisionSchema = {
    dialect: 'vnd.fjs.revision',
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: option(true),
    lock: option(lock),
} as const
```

| Field        | Type                    | Meaning                                                              |
|--------------|-------------------------|------------------------------------------------------------------------|
| `dialect`    | `'vnd.fjs.revision'`    | Format tag — see [Media type](#media-type-and-dialect-tag) below.      |
| `subject`    | `string`                | Identity of the mutable object this revision revises.                  |
| `parents`    | `hash[]`                | Parent revision BLOBs, mainline (first-parent) first — see below. `[]` means this is the first revision. |
| `snapshot`   | `hash`                  | Complete materialized content of this revision. Always stated explicitly. |
| `generation` | `number`                | Generation number — `0` for the first revision, else `1 + max(parent.generation)` for conforming writers. |
| `archived`   | `true` (optional)       | Marks the mutable object as archived/inactive.                         |
| `lock`       | `LockMap` (optional)    | Immutable resolution choices for the revision subjects this snapshot references — see [Lock map](#lock-map). |

`hash` is a cbase32 native CAS address ([fjs/basen/cbase32](../../basen/cbase32/)).
It is the only snapshot-reference type this dialect accepts: `parents` and
`snapshot` always validate as hashes — never `https://` bridge URLs or any
other location-addressed reference form. `subject` is a pure identity string,
never a snapshot reference, so it is never validated as a hash — any string is
a valid `subject`.

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
every future field proposal is measured against.

The rule that produces it: **a field whose absent value would have to be
*derived from other data* is required; optional is reserved for fields whose
absent value is a constant default.** `snapshot` and `generation` are required
because their absence would force inference (a resolution algorithm and an
ancestry walk, respectively). `archived` and `lock` are the two fields on the
permitted side of the rule and stay **optional**: `archived`'s absence is the
constant `false`, so the `option(true)` presence-flag idiom is exactly right —
forcing `archived: false` onto every blob would be pure noise — and `lock`'s
absence is the constant empty map, "this revision records no resolution
choices". Neither absence is derived from anything.

An absent `lock` is not a promise that none is needed. What a resolver does
when a binding it wants is missing — consult heads, ask the caller, refuse — is
its algorithm, not this format's, and that is a statement about resolution, not
about the revision being interpretable. The blob still states its own content
and order completely.

Inference has not disappeared; it moved to the write boundary. The `evo_add`
API ([fjs/cas/evo](../../cas/evo/)) keeps its input conveniences — infer
`subject` from a single parent, compute `generation`, resolve an absent input
`snapshot` (zero parents → `subject` as the reference, one parent → the
parent's snapshot) — and writes every field explicitly. APIs infer; the stored
record never does.

## Lock map

A revision pins its own content, but that content may reference *other*
revision subjects. Resolving those through their current heads makes processing
non-reproducible: the same revision yields a different result later even though
its snapshot never changed. `lock` is where the resolution choices are
recorded, so the same revision can be processed the same way twice.

```ts
type LockMap = {
    readonly[k in string]?: string | LockMap
}
```

A key is a **subject**; a value is either one content hash or a nested,
subject-scoped map. A missing key reads as `undefined`; empty and partial maps
are valid. The recursion is written into the mapped type directly because a
type alias may not reach itself through another alias's instantiation, so
`StringMap<…>` would be TS2456 — see
[fjs/types/object](../../types/object/). A leaf hash is *content* selected for
the subject — the same kind of value `snapshot` carries — not the hash of a
revision blob.

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

Validation is structural plus one refinement, and stays store-independent like
the rest of this module: the recursive record shape, and every leaf decoding as
a cbase32 hash. Nothing is loaded, so no referenced revision's `subject` is ever
compared against a key. Keys are subjects and are therefore never validated as
hashes, exactly as `subject` isn't.

**Why here and not in a lock file.** `package-lock.json`, `deno.lock`,
`bun.lock`, and `Cargo.lock` solve the same problem by generating a file. Keeping
such a file inside the source snapshot mixes source changes with
external-resolution changes; giving lock content its own history would duplicate
`subject`/`parents`/`generation`/`snapshot` wholesale. A lock map is not a
history object — it has no subject, no parents, no generation, no independent
lifecycle. It is resolver *input*, and it rides on the one history mechanism
there is.

The revision DAG already represents every kind of change. A dependency-only
update keeps the snapshot and moves the lock:

```text
R0: snapshot = S0, lock = M0
R1: parents = [R0], snapshot = S0, lock = M1
```

An application may present that as "source unchanged, dependencies updated" by
comparing fields — an interpretation of revision data, not a reason for a second
history. Re-resolving an *old* object rather than moving to newer source is an
ordinary fork from the old revision.

### What the format does not decide

The starting point of processing is the revision's own binding,
`subject -> snapshot`. Beyond that the format defines **no** precedence,
inheritance, scope-lookup, conflict-resolution, dependency-discovery, or
head-selection rule. In particular, all of these are structurally valid and are
accepted:

- an entry for the revision's own subject (`subject: A, snapshot: hashA1,
  lock: { A: hashA0 }`) — a second candidate a resolver may ignore, warn about,
  or use in a different scope;
- bindings for subjects a given resolver never asks about — one map can be
  reused by several related objects;
- a missing binding for a subject it does ask about;
- a nested map that omits the subject it appears under, or that omits entries
  present in the enclosing map.

A nested map records *scoped* information — its intended use is an incompatible
diamond, `A -> B -> D(v1)` and `A -> C -> D(v2)`:

```json
{
  "B": { "B": "snapshot-hash-of-B", "D": "snapshot-hash-of-D-v1" },
  "C": { "C": "snapshot-hash-of-C", "D": "snapshot-hash-of-D-v2" }
}
```

Whether a nested map overlays, replaces, or inherits from the map enclosing it
is the resolver's rule; the format records the nesting and nothing more. Flat
maps stay the common representation — nest only when one flat binding per
subject cannot express the available information.

### Sufficiency is per invocation, not a property of the map

A lock map is not intrinsically "partial" or "complete". Whether it suffices
depends on the resolver and its version, the starting revision and operation,
the resolver's configuration and caller-provided inputs, and the dependencies
discovered while examining content. A map is **sufficient for one resolver
invocation** when that resolver finishes without making an additional unrecorded
choice. `{ "B": … }` is sufficient for a resolver that discovers only `A -> B`,
and insufficient for one that reads B's content and finds `B -> C`. Use
*partial* and *complete* as contextual shorthand, never as properties readable
off the map.

A resolver may use the entries directly, walk first-parent or multi-parent
history, combine caller-provided data with the revision-local map, inspect
content for further dependencies, consult mutable heads, reject unresolved
ambiguity, apply its own deterministic policy, or return an updated map holding
what it used and discovered. Consulting history costs no reproducibility —
every parent reference is an immutable hash — but reproducibility still requires
compatible resolver semantics, and a returned map is not thereby universally
complete.

### Cycles

Mutually recursive subjects resolve from a flat map because entries select
snapshot hashes, not revision hashes. A revision's bytes include its own lock
map, so a lock pointing at *revisions* would make two subjects that reference
each other unhashable. Pointing at snapshots does not: with A referencing B and
C, and B referencing A and C, processing A's revision under

```json
{ "B": "snapshot-hash-of-B", "C": "snapshot-hash-of-C" }
```

plus the starting binding `A -> revision.snapshot` gives a resolver the full
environment for all three, with no content-addressing cycle anywhere.

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

**`lock` is the same kind of risk, admitted through the same open window.**
Adding `lock` is schema-additive, but a reader that ignores it would process
the snapshot against mutable resolutions and silently produce a
non-reproducible result — semantically the `changes` case, not a free extension.
It keeps the tag for exactly one reason, the same one that allowed making
`snapshot` and `generation` required in place: no `vnd.fjs.revision` record has
ever been stored, so there is no old reader to mislead. That window closes the
moment the first revision is written, and after it a field with this profile
needs a new dialect (`vnd.fjs.revision2`) rather than a quiet addition.

**Relaxing a required field is also incompatible.** Making a currently
required field (`snapshot`, `generation`) optional again is allowed, but only
together with a *specified inference algorithm* for the absent value — and,
per the versioning rule above, under a **new dialect**, since a reader of this
dialect rejects a blob missing a required field. The relaxation and its
algorithm are one decision. (This was possible in-place for the current
requirement only because the format is still being designed and no
`vnd.fjs.revision` records have ever been stored — that window closes the
moment the first revision is written.)

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
the existing `option(true)` idiom (a presence-only flag) rather than
`option(boolean)`.

## Out of scope (this module)

- Store-touching evolution operations — head resolution, materialization,
  per-object reverse indexes — are a separate, deferred concern. This module
  is the pure format and its schema/detection only.
- Every resolution algorithm a `lock` map feeds: precedence against the
  starting binding, nested-scope lookup, inheritance, conflict resolution,
  dependency discovery, head selection, and the processor interface that
  accepts a lock and returns an updated one
  ([todo/lock-resolver-interface.md](todo/lock-resolver-interface.md)). The
  format records choices; it never makes them.
- A separate lock/freeze history format with its own `parents`/`generation`,
  and ecosystem-specific npm/Deno/Bun/Cargo/Nix adapters. A shared,
  history-free `vnd.fjs.lock` blob — so a large or shared environment need not
  be repeated inline, with a hash in a lock map (or the whole `lock` field)
  referencing it, recognized by the target's content dialect — is a possible
  future extension, deliberately not in this first version.
- Full build reproducibility. A lock map pins the resolution of revision
  subjects; compiler versions, platforms, configuration, undeclared
  environment state, and nondeterministic processors are outside what it can
  say anything about.
- The incremental-change dialect `vnd.fjs.change` (event log, likely
  CRDT-based) and how it links to revisions — a future, separate dialect
  ([fjs/media change-content-format](../todo/change-content-format.md)).
- Snapshot-reference forms beyond cbase32 hashes, and the syntax of a
  content-addressed revision reference (e.g. `{hash}.{generation}.{hash}` —
  `hash.generation` alone does not pin a version across branches; undefined
  for now, only hashes are used). Subject identity strings are already
  unconstrained, since `subject` is never a snapshot reference.
- Digital signatures for filtering changes from unknown users — a future,
  separate spec. Further out, a `{public-key}/{name}.{generation}` reference
  form, where the key's owner defines what `{name}` means: anchoring the
  identifier in a signer ties format identity to the web of trust
  ([todo/plan/vision.md](../../../todo/plan/vision.md)'s `~/Alice/...`
  relative-path model) and says whose evolution of `{name}` a blob follows.
