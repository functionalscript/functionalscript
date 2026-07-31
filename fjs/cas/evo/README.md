# Evo

The Evo API resolves subjects and revision heads over the content-addressable store
([`fjs/cas`](../), [`vnd.fjs.revision`](../../media/revision/)) without
rescanning the store on every query.

A `Cas<O>` stores `vnd.fjs.revision` blobs like any other content: immutable
bytes under a hash. Resolving "what are the current heads of subject X"
means walking every stored revision and reversing the `parents` links — too
expensive to redo per request. `fjs/cas/evo/module.f.ts` scans the whole store
once into an in-memory `Cache` (keyed with
[`fjs/effects/memory`](../../effects/memory/module.f.ts)) mapping subject →
head hashes, then keeps that cache current as new revisions are `add`ed
through it.

Not every operation is cache-backed: `revision(hash)` reads one revision
straight from the store and returns it decoded, validated, and canonicalized,
so no client has to interpret raw revision bytes itself.

## API

```ts
type Evo<O> = {
    list: () => Effect<MemOp, readonly Subject[]>
    head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    add: (rev: RevisionData) => Effect<O | MemOp, Result<Hash, string>>
    revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionData, string>>
}
```

- `list()` and `head(subject)` read only the in-memory cache — no store
  access, no rescanning.
- `add(rev)` resolves `rev`'s `subject` (explicit, or inherited from a single
  parent — see below), assembles and checks a `vnd.fjs.revision` blob, writes
  it to the store, and folds it into the cache in one step.
- `revision(hash)` reads one revision from the store, decoded, validated, and
  canonicalized — see [Reading one revision](#reading-one-revision).

There is no way yet to fetch a subject's full history (every revision behind
its head(s), not just the head(s) themselves) — see
[`todo/subject-history.md`](todo/subject-history.md).

## `RevisionData`

```ts
type RevisionData = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash
    readonly subject?: Subject
    readonly archived?: true
    readonly generation?: number
}
```

One structure is the whole vocabulary of both directions: `add` takes it and
`revision` returns it, so what you add is what you get back and a value read
back can be added again unchanged, with no fields to strip. It is the
media-level `Revision` ([`fjs/media/revision`](../../media/revision/)) minus
`dialect` — a serialization tag with no information left once validation has
passed; the evo layer speaks the semantic content of a revision, the same in
both directions.

Every direction-specific field is optional, with the per-direction guarantees
documented rather than typed (no extension or intersection types):

| field        | as input to `add`                          | as output of `revision`     |
|--------------|--------------------------------------------|-----------------------------|
| `parents`    | required                                   | always present, canonical   |
| `subject`    | absent → inherited from the single parent  | always present              |
| `snapshot`   | absent → resolved from the parents         | always present, canonical   |
| `archived`   | optional                                   | optional (the only one)     |
| `generation` | **ignored** — the server computes it       | always present              |

`generation` is an input field purely so the round trip needs no field
stripping; `add` always writes the value it computes itself.

**Why relax what the format requires.** The stored `vnd.fjs.revision` blob
requires `subject`, `snapshot` and `generation`, and `revision(hash)` does
return all three — but `RevisionData` is not that blob's type. It is the type
of the API that *reads and constructs* revisions, and its purpose is to make
both easy: `add` asks only for what a caller can actually know, resolving or
computing the rest at the write boundary, and a read hands back a value that
goes straight into `add` again. Typing the output's guarantees instead of
documenting them would state one direction more precisely at the cost of
splitting the one vocabulary into two — the trade this API declines.
[`fjs/media/revision`](../../media/revision/)'s `Revision` remains the
all-required type of the stored blob for anyone who wants it.

The stored `vnd.fjs.revision` blob requires an explicit `snapshot` and
`generation` (see [`fjs/media/revision`](../../media/revision/)), so `add`
resolves both at the write boundary — the inference the format used to carry,
run once here with the parents already fetched:

- `snapshot`, when omitted, is resolved from the parents: zero parents fall
  back to `subject` as the snapshot reference (which must then be a hash), one
  parent inherits its stored `snapshot`, and more than one parent without an
  explicit `snapshot` cannot be resolved (an explicit `snapshot` is required
  for a merge). An explicit input `snapshot` is used as-is.
- `generation` is computed, never taken from input: `0` for a root, else
  `1 + max(parents' generations)`. Everything `add` writes follows the formula
  by construction.
- `subject`, when omitted, is inherited from the single parent's own `subject`
  field (a revision has no format-level subject-inheritance rule the way it
  does for `snapshot`, so `addRevision` resolves it explicitly by reading the
  parent); it cannot be resolved with zero or more than one parent and no
  explicit `subject`.

## Reading one revision

`revision(hash)` is the typed read: it fetches the blob at `hash`, decodes and
validates it as a `vnd.fjs.revision`, and returns its content as
[`RevisionData`](#revisiondata). `add` validates on the way in, `revision`
validates on the way out — layering, not duplication. The generic "raw bytes
by hash" read (`cas.read`, `cas_get`) stays the way to fetch arbitrary
content: snapshots, and anything else that is not a revision.

Two things make it more than a convenience over a raw read:

- **Canonical hashes.** cBase32 accepts alias spellings of the same hash
  (case, `i`/`l`/`o`), and everything else this API returns is canonical. A
  blob's stored `parents`/`snapshot` carry whatever spelling its writer used,
  so a client comparing raw-blob strings against `head` output would silently
  miss a match. `revision` re-spells every reference canonically, so its
  output compares directly against `head`'s.
- **One validator.** JSON parsing, schema validation, the `dialect` check and
  the hash checks happen once, server-side, instead of in every client.

Every way it can fail is its own message, not one `null`: the hash is not
cBase32, the store has nothing under it, the store has it but could not
deliver it, or what it holds is not a revision. (The internal
`decodeRevisionBlob` deliberately collapses all but the first — it exists to
scan stores that contain arbitrary content.)

Only a genuine miss — `isNotFound`, the same ENOENT test `fjs/cas`'s `list`
uses — is reported as *not found*. A `Cas` read can also fail on a blob that
is really there (a permission or mid-stream I/O error, or content too large to
buffer into one `Vec`), and answering "not found" to those would deny that a
stored revision exists. A blob deleted *during* the read counts as a miss: the
store no longer has it by the time the answer is given, and the next read says
the same thing with no race left in it.

Each call is a store round trip. A per-revision memo cache is possible later —
a revision is immutable, so it can never go stale — which is why the operation
is declared over `O | MemOp` even though today it touches only the store.

## Head resolution

A **head** of a subject is any stored revision of that subject whose hash is
not referenced as a `parents` entry by another revision of the same subject.
Because revisions form a DAG (no cycles), that definition is order
independent: folding "this hash is a head of its subject; drop its parents
from that subject's head set" over every stored revision, in any order,
converges to the same result. `buildCache` does this once for the whole
store at startup; `addRevision` repeats the same fold for a single new
revision, incrementally.

## Cross-subject parents

`add` requires every parent to belong to the revision's own `subject`. The
`vnd.fjs.revision` format itself never forbade cross-subject parents — its
epoch-reset scenario is exactly that: a new subject formed from an old one,
still listing its origin in `parents` to show how it was formed (see
[`fjs/media/revision`](../../media/revision/)). The restriction is an
evo-layer one, and it is deliberate:

- A revision models one step in the evolution of a *single* mutable object.
  Silently inheriting `subject` or `snapshot` across that boundary would graft
  the new revision onto an unrelated object's history, and head demotion is
  scoped to `revision.subject`, so nothing about the cross-subject case
  behaves the way the rest of this API's rules read.
- The mainline walk ([`todo/subject-history.md`](todo/subject-history.md)) is
  designed against a closed subject: allowing cross-subject parents would let
  a walk cross into another subject's revisions. That may well be the point of
  an epoch reset, but it is a design decision for that feature, not a side
  effect of relaxing a check here.
- Only the strict direction is reversible. Accepting cross-subject parents
  later is a compatible relaxation — writes that used to fail start
  succeeding. Tightening later would break writers that had relied on it. With
  no consumer needing the epoch-reset scenario today, staying strict keeps the
  choice open.

Nothing stops such a revision from being *stored* — a raw `cas_add` of a
hand-written blob is accepted, and reading it back with `revision(hash)`
works. The restriction is on what `add` will construct.

## Failure reporting

Every `add` failure — an unresolvable `subject` or `snapshot`, a revision that
fails the `vnd.fjs.revision` hash / generation semantics, a blob too large to
encode, or a store write failure — and every `revision` failure — an
undecodable hash, a hash the store has nothing under, a read that failed for
any other reason, a blob that is not a revision — comes back as
`error(message)` (`fjs/types/result`), never a
`throw`, so a transport (e.g. the MCP adapter,
[`fjs/mcp/evo`](../../mcp/evo/)) can surface it to the caller directly.

## Front ends

- [`fjs/mcp/evo`](../../mcp/evo/) — MCP tool definitions (`evo_list` / `evo_head` /
  `evo_revision` / `evo_add`) for agents, served by the same process as
  [`fjs/mcp`](../../mcp/)'s `cas_add`/`cas_get`/`cas_list` — one
  `~/.cas/` store, one Evo cache, one server (`npx functionalscript m`).

## In-memory cache is per process

The cache lives in one process's memory, so every `cas`/`evo` MCP server
instance ([`fjs/mcp`](../../mcp/)) builds and holds its own — there is no
sharing across concurrently running instances. An HTTP(S) MCP server would
let many clients share one cache and one process; two possible shapes for
that, neither implemented yet:

1. A proper HTTP(S) MCP server — requires an authentication design first
   (see [`fjs/cas/todo/web-api-server.md`](../todo/web-api-server.md), which
   this same per-process limitation motivates for CAS more broadly).
2. One API HTTP(S) server plus multiple STDIO MCP proxy servers — only worth
   it for clients that can't speak HTTP(S) MCP directly.

A related but distinct gap: even a single running server's cache can go
stale if something other than this process writes to `~/.cas/` (the `cas`
CLI, another MCP server instance) — see
[`todo/cache-staleness.md`](todo/cache-staleness.md).
