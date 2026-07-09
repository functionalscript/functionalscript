# Content-addressable store (`fs/cas`)

A content-addressable store: content is addressed by the hash of its bytes,
so writing the same content twice always yields the same address, and every
address is exactly the content it names.

`fs/cas/module.f.ts` is the core store facade: `Cas<O>` (`read`/`write`/`list`)
and `fileCas(sha2)(path)`, a filesystem-backed implementation sharded by
cBase32-encoded hash under `<path>/.cas/`. It stays focused on
hashing/addressing — transport and higher-level operations live in sibling
directories:

- [`fs/cas/cli/`](cli/) — the `cas` CLI commands (`add`, `get`, `list`).
- [`fs/cas/mcp/`](mcp/) — an [MCP](../mcp/) front end exposing the same
  operations as tools (`cas_add`, `cas_get`, `cas_list`).
- [`fs/cas/evo/`](evo/) — store-touching operations for the `revision`
  content format (see below): head resolution and content materialization.

## Content formats

A CAS blob is just bytes under a hash; recognizing *what* a blob is (its
media type) is the job of [`fs/mime`](../mime/) (magic-byte/UTF-8 detection)
and, for formats that self-declare a type, the format's own `mimeType` field.

- [`fs/media/revision`](../media/revision/) — the `revision` content format:
  a BLOB representing one step in the evolution of a mutable object (a
  document, a config, any piece of mutable state addressed by a stable
  `object` identity) on top of this immutable store. Revisions link back to
  parent revision(s) as a DAG, so concurrent edits can merge like Git
  branches. The format itself (schema, `mimeType` tag, semantic decoding) is
  pure and store-independent; [`fs/cas/evo`](evo/) is where head resolution
  and materialization actually touch the store.
