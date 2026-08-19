## Cache compiled modules for incremental compilation

**Priority:** P3
**Status:** open

**Blocked by:** [`compile-modules-to-edag.md`](./compile-modules-to-edag.md)

### Goal

Persist the temporary compiled `Module` representation so incremental compilation can
reuse a module without parsing it again when the source file has not changed.

This cache is an optimization around the temporary module representation. It does not
change EDAG and does not change the final compilation result: after module resolution,
the compiler still produces one final EDAG.

### Module metadata

The temporary module representation contains enough source identity information to
validate a cached entry:

```ts
type Module = {
    readonly hash: string
    readonly path: string
    readonly imports: readonly string[]
    readonly edag: EDAG
}
```

- `hash` is the CBase32-encoded hash of the original source file contents.
- `path` is the source module path relative to the `.fjs/` / current-working-directory
  context used by the compiler. It may contain parent components for modules outside
  that tree, for example `../../third_party/something.f.js`.
- `imports` remains a source-ordered array of module paths, not a map.
- `edag` is the parameterized EDAG produced from that source module before imports are
  resolved.

`hash` and `path` are compiler/cache metadata. They are not fields of EDAG.

### Cache layout

Store cached modules under:

```text
.fjs/modules/{pathHash}.f.js
```

`pathHash` is a hash of the relative `Module.path`, encoded using the cache's canonical
CBase32 hash representation. The source path itself is not used as the cache filename,
so paths containing `/`, `..`, or platform-specific filesystem characters do not
create a nested or invalid cache layout.

The cached value still stores `Module.path`; the filename hash is only an index into
the cache, not a replacement for the source-path identity stored in the `Module`.

The cache files are build artifacts and must not be source-controlled.

### Incremental lookup

For a source module at relative path `path`:

```text
path
  -> pathHash
  -> .fjs/modules/{pathHash}.f.js
```

If the cache file exists:

1. load the cached `Module`;
2. verify that its stored `path` is the requested relative source path;
3. hash the current source file contents and encode the hash in CBase32;
4. compare that value with `Module.hash`;
5. if they are equal, reuse `Module.imports` and `Module.edag` without parsing the
   source module again;
6. otherwise parse/compile the source again and replace the cached `Module`.

Conceptually:

```text
source path
  -> cache path from hash(source path)
  -> cached Module?
       |
       +-- cached.hash == hash(source bytes) --> reuse Module
       |
       +-- otherwise -------------------------> parse -> Module -> cache
```

This makes source parsing incremental independently for each module. Import contents
do not participate in validating the cached source-to-`Module` result; imported
modules have their own cache entries and are resolved separately.

### Cache invalidation beyond source contents

A matching source hash proves only that the source bytes are unchanged. The persistent
cache must also be invalidated when the compiler or EDAG format changes in a way that
can change the generated `Module.edag`. Define that invalidation mechanism separately
from the four-field `Module` structure; do not add unrelated cache-version fields to
`Module` merely for persistence.

### Tasks

- [ ] Define the canonical normalization of `Module.path` before hashing or storing it.
- [ ] Define the source-file hash algorithm and its CBase32 encoding.
- [ ] Define the path-hash algorithm/encoding used for
      `.fjs/modules/{pathHash}.f.js`.
- [ ] Serialize and load the temporary `Module` as a `.f.js` cache artifact.
- [ ] On lookup, verify both the stored `Module.path` and source-content `Module.hash`.
- [ ] Reuse a valid cached `Module` without parsing the source file.
- [ ] Recompile and replace the cache entry when the source-content hash changes.
- [ ] Define compiler/EDAG-version cache invalidation without extending the canonical
      four-field `Module` structure for that purpose.
- [ ] Ignore `.fjs/` cache artifacts in source control.
- [ ] Add proofs/tests for cache hit, source-content cache miss, path mismatch, modules
      outside the working tree using `..`, and compiler/EDAG-version invalidation.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — defines the temporary
  `Module` and resolves all temporary modules into one final EDAG.
