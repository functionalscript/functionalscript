## Cache compiled modules for incremental compilation

**Priority:** P3
**Status:** open

**Blocked by:** [`compile-modules-to-edag.md`](./compile-modules-to-edag.md)

### Goal

Persist the temporary compiled `Module` representation so incremental compilation can
reuse a module without parsing it again when the source file has not changed.

This cache is an optimization around the temporary module representation. It does not
change `Module`, EDAG, or the final compilation result: after module resolution, the
compiler still produces one final EDAG.

The temporary module type remains:

```ts
type Module = {
    readonly imports: readonly string[]
    readonly edag: EDAG
}
```

Source identity belongs to the cache key, not to `Module`.

### Cache layout

Hash the original source-file bytes with SHA-256 and encode the digest in CBase32:

```text
hash = CBase32(SHA256(source bytes))
```

Store the compiled temporary module at:

```text
.fjs/modules/{hash}.f.js
```

The filename is therefore content-addressed by the original source file itself. The
cached `.f.js` value contains only the normal temporary `Module { imports, edag }`.
There is no `hash` or `path` field inside `Module`.

The cache files are build artifacts and must not be source-controlled.

### Incremental lookup

For a source module:

```text
source bytes
  -> SHA-256
  -> CBase32
  -> .fjs/modules/{hash}.f.js
```

If that cache file exists, load its `Module` and reuse `imports` and `edag` without
parsing the source module again. If it does not exist, parse/compile the source to a
`Module` and save that module at the content-addressed cache path.

Conceptually:

```text
source bytes
  -> hash
  -> cached Module?
       |
       +-- yes --> reuse Module
       |
       +-- no  --> parse -> Module -> cache
```

A changed source file naturally produces a different hash and therefore a different
cache path. No source hash needs to be duplicated inside the cached `Module`.

### Cache invalidation beyond source contents

The source hash identifies the source bytes, but compiler or EDAG-format changes may
still make an old cached `Module` unusable even when the source bytes are unchanged.
Define cache-version invalidation separately from `Module`; do not add cache metadata
to the temporary module structure merely for persistence.

### Possible second-level cache

This first cache stores the **unresolved** temporary `Module` produced directly from
one source file.

Later, we may add a second level of caching for **resolved modules**, after imported
modules have themselves been resolved. Such a cache could avoid repeating module
resolution/linking when the complete dependency inputs are unchanged.

This note intentionally does not define the identity/key or representation of that
second-level cache yet.

### Tasks

- [ ] Define the exact SHA-256 -> CBase32 encoding used for source cache keys.
- [ ] Store temporary modules as `.fjs/modules/{hash}.f.js`, where `hash` is computed
      from the original source-file bytes.
- [ ] Serialize and load the unchanged `Module { imports, edag }` representation.
- [ ] Reuse a cached `Module` without parsing when the content-addressed cache entry
      exists.
- [ ] Parse/compile and create the cache entry when it does not exist.
- [ ] Define compiler/EDAG-version cache invalidation outside the `Module` structure.
- [ ] Ignore `.fjs/` cache artifacts in source control.
- [ ] Add proofs/tests for cache hit, cache miss after source changes, and
      compiler/EDAG-version invalidation.
- [ ] Keep the possible resolved-module second-level cache as future work until its
      identity and representation are designed.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — defines the unchanged
  temporary `Module { imports, edag }` and resolves temporary modules into one final
  EDAG.
