## hash-fields-traversal. Which fields of a revision hold hashes is listed here and twice in `cas/evo`

**Priority:** P3
**Status:** open

### Problem

A `vnd.fjs.revision` document carries hashes in `parents`, `snapshot`
and the leaves of the `lock` map. That is format knowledge, and this
module states it once, in `checkReferences` and `lockError`:

```js
for (const p of r.parents) { if (!isHash(p)) … }
if (!isHash(r.snapshot)) …
lockFieldError(r.lock)
```

`fjs/cas/evo` then states it twice more, to canonicalise the same
fields before hashing a head:

```js
// buildRevision
parents: revision.parents.map(canonicalHash),
snapshot: canonicalHash(revision.snapshot),
...(revision.lock === undefined ? {} : { lock: canonicalLockField(revision.lock) })
// toRevisionData
parents: parents.map(canonicalHash), snapshot: canonicalHash(snapshot), …
lock: lock === undefined ? undefined : canonicalLockField(lock)
```

with `canonicalLock`/`canonicalLockField` re-walking the lock map along
the split this module's `lockFieldError` walks, as their own doc says. A
new hash-bearing field needs four edits, and forgetting the evo ones
does not fail: the head is computed over the uncanonical spelling and
two spellings of one revision get two heads.

`canonicalHash` itself, `vecToCBase32(unwrap(cBase32ToVec(h)))`, is a
cBase32 operation kept privately in evo; `fjs/mcp/cas`'s `cas_get`
performs the same round trip by hand.

### Proposal

This module owns the traversal, and the validator and the
canonicaliser are two uses of it. The validator needs to *find* — the
first field that is not a hash, with the path its message names — and
the canonicaliser needs to *rebuild*, so the export is the enumeration
plus the map, both over one private walk:

```ts
/** Every hash-bearing field of a revision, with its path: `['parents', '0']`, `['snapshot']`, `['lock', 'a', 'b']`. */
export const hashEntries: (r: Revision) => readonly (readonly [readonly string[], string])[]
/** Every hash-bearing field of a revision under `f`; the lock map to its leaves. */
export const mapHashes: (f: (h: Hash) => Hash) => (r: Revision) => Revision
```

`checkReferences` is `hashEntries(r).find(([, h]) => !isHash(h))`
turned into today's messages, with no captured state and no second
walk; `lockError` goes with it. `fjs/basen/cbase32` exports the
canonical spelling, `canonicalCBase32: (s: string) => Nullable<string>`.
Evo's `buildRevision` and `toRevisionData` become
`mapHashes(canonical)`, and `cas_get` uses the same export.

### Tasks

- [ ] `hashEntries` and `mapHashes` here, `canonicalCBase32` in
      `cbase32`, with proofs.
- [ ] `checkReferences` over `hashEntries`, its messages unchanged;
      evo's two builders over `mapHashes`; `canonicalLock`,
      `canonicalLockField` and `lockError` go.
- [ ] `tsc`, `fjs test`; the evo head proofs pass unchanged.

### Related

- [../../todo/json-dialect-factory.md](../../todo/json-dialect-factory.md)
  — the per-dialect kit around this format; this issue is inside the
  format.
- [../../../cas/todo/66k-cas-cli-mcp-shared-core.md](../../../cas/todo/66k-cas-cli-mcp-shared-core.md)
  — hash parsing shared between CLI and MCP; the canonical spelling is
  one more thing they would share.
