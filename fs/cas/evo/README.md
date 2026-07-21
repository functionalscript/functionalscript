# Evo

The Evo API resolves subjects and revision heads over the content-addressable store
([`fs/cas`](../), [`vnd.fjs.revision`](../../media/revision/)) without
rescanning the store on every query.

A `Cas<O>` stores `vnd.fjs.revision` blobs like any other content: immutable
bytes under a hash. Resolving "what are the current heads of subject X"
means walking every stored revision and reversing the `parents` links — too
expensive to redo per request. `fs/cas/evo/module.f.ts` scans the whole store
once into an in-memory `Cache` (keyed with
[`fs/effects/memory`](../../effects/memory/module.f.ts)) mapping subject →
head hashes, then keeps that cache current as new revisions are `add`ed
through it.

## API

```ts
type Evo<O> = {
    list: () => Effect<MemOp, readonly Subject[]>
    head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    add: (rev: AddRevision) => Effect<O | MemOp, Result<Hash, string>>
}
```

- `list()` and `head(subject)` read only the in-memory cache — no store
  access, no rescanning.
- `add(rev)` resolves `rev`'s `subject` (explicit, or inherited from a single
  parent — see below), assembles and checks a `vnd.fjs.revision` blob, writes
  it to the store, and folds it into the cache in one step.

`AddRevision`:

```ts
type AddRevision = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash
    readonly subject?: Subject
    readonly archived?: true
}
```

`snapshot`, when omitted, follows the `vnd.fjs.revision` format's own
inheritance/fallback rules (zero parents fall back to `subject` as the
snapshot reference, one parent inherits its snapshot, more than one parent
without an explicit `snapshot` is invalid) — this module does not re-derive
that. `subject`, when omitted, is inherited from the single parent's own
`subject` field (a revision has no format-level subject-inheritance rule the
way it does for `snapshot`, so `addRevision` resolves it explicitly by
reading the parent); it cannot be resolved with zero or more than one parent
and no explicit `subject`.

## Head resolution

A **head** of a subject is any stored revision of that subject whose hash is
not referenced as a `parents` entry by another revision of the same subject.
Because revisions form a DAG (no cycles), that definition is order
independent: folding "this hash is a head of its subject; drop its parents
from that subject's head set" over every stored revision, in any order,
converges to the same result. `buildCache` does this once for the whole
store at startup; `addRevision` repeats the same fold for a single new
revision, incrementally.

## Failure reporting

Every `add` failure — an unresolvable `subject`, a revision that fails the
`vnd.fjs.revision` snapshot-reference semantics, a blob too large to encode,
or a store write failure — comes back as `error(message)`
(`fs/types/result`), never a `throw`, so a transport (e.g. the MCP adapter,
[`fs/cas/evo/mcp`](mcp/)) can surface it to the caller directly.

## Front ends

- [`fs/cas/evo/mcp`](mcp/) — MCP tool definitions (`evo_list` / `evo_head` /
  `evo_add`) for agents, served by the same process as
  [`fs/cas/mcp`](../mcp/)'s `cas_add`/`cas_get`/`cas_list` — one
  `~/.cas/` store, one Evo cache, one server (`npx functionalscript m`).

## In-memory cache is per process

The cache lives in one process's memory, so every `cas`/`evo` MCP server
instance ([`fs/cas/mcp`](../mcp/)) builds and holds its own — there is no
sharing across concurrently running instances. An HTTP(S) MCP server would
let many clients share one cache and one process; two possible shapes for
that, neither implemented yet:

1. A proper HTTP(S) MCP server — requires an authentication design first
   (see [`fs/cas/todo/web-api-server.md`](../todo/web-api-server.md), which
   this same per-process limitation motivates for CAS more broadly).
2. One API HTTP(S) server plus multiple STDIO MCP proxy servers — only worth
   it for clients that can't speak HTTP(S) MCP directly.
