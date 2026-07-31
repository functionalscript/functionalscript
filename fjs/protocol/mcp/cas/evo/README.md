# Evo MCP tools

MCP tool definitions for the Evo API ([`fjs/cas/evo`](../../../../cas/evo/)): subjects,
revision heads, and the typed read of a single revision over the
content-addressable store ([`fjs/cas`](../../../../cas/)), backed by the in-memory cache
the core module maintains.

These tools are not their own server. They are served by the same process as
`cas_add`/`cas_get`/`cas_list`: [`fjs/protocol/mcp/cas`](../) builds one
`Evo<O>` from its own `Cas<O>` and cache slot (`initEvo`, scanned once at
startup), concatenates `evoToolRegistry` onto its own tool registry, and
serves everything — one `~/.cas/` store, one Evo cache, one server, one
`npx functionalscript m`. See [`fjs/protocol/mcp/cas/README.md`](../README.md)
for how to run it and register it with an MCP client.

## Tools

| Tool           | args                                         | action            | result                               |
|----------------|----------------------------------------------|-------------------|--------------------------------------|
| `evo_list`     | `{}`                                         | `e.list()`        | subjects, as a JSON array of strings |
| `evo_head`     | `{ subject }`                                | `e.head(...)`     | head hashes, one per line            |
| `evo_revision` | `{ hash }`                                   | `e.revision(...)` | the revision, as JSON                |
| `evo_add`      | `{ parents, snapshot?, subject?, archived? }` | `e.add(...)`      | hash (cBase32)                       |

`evo_list` returns JSON rather than the newline-joined line format `evo_head`/`cas_list` use: subjects are arbitrary caller-supplied strings, not constrained to a newline-free alphabet the way hashes are, so a subject containing `\n` (or an empty subject) would be ambiguous in a line-based format.

## `evo_revision` vs `cas_get`

`evo_revision` is the typed read of a single revision: `{ subject, parents,
snapshot, generation, archived? }` — the JSON of `fjs/cas/evo`'s
`RevisionData` (see [`fjs/cas/evo/README.md`](../../../../cas/evo/README.md)), with `dialect`
dropped and every hash in its canonical cBase32 spelling, so `parents` and
`snapshot` compare directly against `evo_head` output. `parents[0]` is the
mainline parent; every further entry is a merged-in branch.

`cas_get` ([`fjs/protocol/mcp/cas`](../)) stays the generic raw-bytes tool for
arbitrary blobs — snapshots and any other non-revision content. `get` means
"raw bytes by hash" throughout these tools, which is why this one is not
called `evo_get`: leaving agents to decode, validate and canonicalize a raw
revision blob themselves is exactly what it exists to avoid.

`evo_add` and `evo_revision` speak the same structure in opposite directions,
so a revision read back can be added again as-is. The one field
`evo_revision` returns that `evo_add`'s schema does not name is `generation`,
which the server computes; rtti struct validation ignores properties the
schema does not name, so a whole `evo_revision` result can be passed straight
back to `evo_add`.

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../../../media/json/schema/module.f.ts) derives the
`inputSchema` advertised in `tools/list`, and
[`validate`](../../../../types/rtti/validate/module.f.ts) decodes the
`arguments` object in `tools/call` — the same pattern as
[`fjs/protocol/mcp/cas`](../).

## Errors

- Invalid `arguments` (rtti `validate` rejects the object, e.g. a missing
  `parents`) → `isError`, reported by the shared `toolEntry` machinery before
  the domain logic runs.
- A domain-level `evo_add` failure — an unresolvable `subject`, an invalid
  `vnd.fjs.revision` (see [`fjs/media/revision`](../../../../media/revision/)),
  a blob too large to encode, or a store write failure — → `isError` with the
  message from `Evo.add`'s `Result`.
- A domain-level `evo_revision` failure → `isError` with the message from
  `Evo.revision`'s `Result`, which keeps every case distinct: a `hash` that is
  not cBase32, a hash the store has nothing under, a read that failed for
  another reason (so an unreadable blob is never reported as a missing one),
  and a blob that is not a revision.
- A response too large to encode → the transport's `-32603`, not a tool-level
  error. `evo_list` and `evo_revision` carry JSON as MCP text content, so the
  JSON-RPC serializer escapes it again and an encoded line can outgrow the cap
  even when the value itself is small (a subject of quote characters is the
  worst case). [`fjs/protocol/mcp/stdio`](../../stdio/module.f.ts) then retries
  with a small internal-error body that keeps the request's `id` — the same
  envelope every tool has, `cas_get` included. A tool cannot turn this into a
  descriptive error of its own: whether the encoded response fits is known
  only by encoding it, and predicting that from an unencoded size is the kind
  of estimate this codebase does not make.

## Testing without a live process

`evoToolRegistry` is generic in the store's operation type `O` and takes a
plain `Evo<O>`, so `proof.f.ts` exercises each tool entry's `handle` directly
against an in-memory `Evo` — no MCP session or live process required.
