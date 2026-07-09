# CAS — content-addressable storage

Hashing, addressing, and path parsing for a filesystem-backed
content-addressable store: `fileCas` streams content in and out under a
SHA-256 content hash (cBase32-encoded), with lock-free staging uploads so
concurrent writers never corrupt each other's blobs.

- [`cli/`](./cli/) — the `cas` command-line front end (`cas add`, `cas get`, ...)
- [`mcp/`](./mcp/) — an MCP server front end (`cas_add`, `cas_get`, `cas_list`)
- [`evo/`](./evo/) — the `revision` content format: evolving mutable objects
  (documents, configs, any stable-named mutable state) on top of the
  otherwise-immutable store, via a DAG of revision BLOBs
