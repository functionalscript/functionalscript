# Evo API

The server scans the whole CAS at the start and form a cache. Then, it can periodically scan for a new hashes in CAS and update the cache.

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
    // Add a new head.
    add: (rev: AddRevision) => Hash
}
```
