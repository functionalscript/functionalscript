# Evo API

## Proposed API

The server scans the whole CAS at the start and form a cache using `Mem` effects. Then, it can periodically scan for a new hashes in CAS and update the cache. The following MCP API should use the cache.

```ts
type Hash = string

type Subject = string

type AddRevision = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash
    readonly subject?: Subject
    readonly archived?: true
}

type Evo = {
    // Returns a list of all subjects.
    list: () => Subject[]
    // Returns a list of all heads. Hashes to Revisions.
    // Each hash can be used get a Revision using `cas_get`.
    head: (subject: Subject) => Hash[]
    // Add a new head. The function updates both, CAS and the cache.
    add: (rev: AddRevision) => Hash
}
```

### In-Memory Cache

In-memory cache is per process, so every new STDIO MCP server creates a new in-memory cache. An alternative is to use HTTP(S) MCP server. Two possible approaches:

1. A proper HTTP(S) MCP server. It requires an implementation of authentication.
2. One API HTTP(S) server and multiple STDIO MCP proxy servers.
