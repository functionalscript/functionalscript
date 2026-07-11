## Evo API

**Priority:** P2
**Status:** open

### Problem

CAS users need a way to work with evolving subjects whose revisions are stored
as content-addressed values. Without a small Evo API, clients must repeatedly
scan the CAS and reconstruct revision heads themselves.

### Proposal

The server scans the whole CAS at startup and builds a cache using `Mem`
effects. Then it can periodically scan for new hashes in CAS and update the
cache. The following MCP API should use the cache.

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

### Tasks

- [ ] Define the revision representation stored in CAS.
- [ ] Build and refresh the in-memory subject/head cache from CAS.
- [ ] Expose `list`, `head`, and `add` through the MCP API.
- [ ] Add proof and integration coverage for revision creation and head updates.

### Related

- PR feedback — add required todo metadata so this design is triageable by the
  priority/status workflow.
