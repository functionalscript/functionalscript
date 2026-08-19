## Cache unresolved modules for incremental compilation

**Priority:** P3
**Status:** open

**Blocked by:** [`compile-modules-to-edag.md`](./compile-modules-to-edag.md)

### Goal

Persist the temporary `Unresolved` representation so incremental compilation can
reuse a module without parsing it again when the source file has not changed.

This cache is an optimization around the temporary unresolved representation. It does
not change `Unresolved`, EDAG, or the final compilation result: after module
resolution, the compiler still produces one final EDAG.

The temporary type remains:

```ts
type Unresolved = {
    readonly imports: readonly string[]
    readonly edag: EDAG
}
```

Source identity belongs to the cache key, not to `Unresolved`.

### Cache layout

Hash the original source-file bytes with SHA-256 and encode the digest in CBase32:

```text
hash = CBase32(SHA256(source bytes))
```

Store the compiled unresolved value at:

```text
.fjs/unresolved/{hash}.f.js
```

The filename is therefore content-addressed by the original source file itself. The
cached `.f.js` value contains only the normal temporary `Unresolved { imports, edag }`.
There is no `hash` or `path` field inside `Unresolved`.

The cache files are build artifacts and must not be source-controlled.

### Incremental lookup

For a source module:

```text
source bytes
  -> SHA-256
  -> CBase32
  -> .fjs/unresolved/{hash}.f.js
```

If that cache file exists, parse and validate the cached `Unresolved`. Reuse `imports`
and `edag` without parsing the source module only when the cache artifact itself is
valid.

Any cache read, parse, schema-validation, or EDAG-validation failure is an ordinary
**cache miss**. The compiler must fall back to parsing/compiling the original source;
a corrupt, truncated, manually modified, or stale cache artifact must not make the
build fail merely because the cache exists.

If the cache file does not exist or is invalid, parse/compile the source to an
`Unresolved` and save a replacement cache entry.

Conceptually:

```text
source bytes
  -> hash
  -> cached Unresolved?
       |
       +-- valid ----------> reuse Unresolved
       |
       +-- missing/invalid -> parse -> Unresolved -> cache
```

A changed source file naturally produces a different hash and therefore a different
cache path. No source hash needs to be duplicated inside the cached `Unresolved`.

### Source maps

The unresolved cache must not make warm builds lose source information.

The source-map design is intentionally separate and source metadata must not be
embedded into `Unresolved.edag`. Until a compatible per-unresolved source-map
cache/sidecar is defined, **bypass the unresolved cache when source maps are
requested** and parse the source normally so the same source ranges are available as
in a cold build.

A future source-map cache may remove that restriction, but a cache hit must then
restore the same mapping information as parsing the source.

### Cache invalidation beyond source contents

The source hash identifies the source bytes, but compiler or EDAG-format changes may
still make an old cached `Unresolved` unusable even when the source bytes are unchanged.
Define cache-version invalidation separately from `Unresolved`; do not add cache
metadata to the temporary structure merely for persistence.

### Possible second-level cache

This first cache stores the **unresolved** temporary `Unresolved` produced directly
from one source file.

Later, we may add a second level of caching for **resolved modules**, after imported
modules have themselves been resolved. Such a cache could avoid repeating module
resolution/linking when the complete dependency inputs are unchanged.

This note intentionally does not define the identity/key or representation of that
second-level cache yet.

### Tasks

- [ ] Define the exact SHA-256 -> CBase32 encoding used for source cache keys.
- [ ] Store temporary unresolved values as `.fjs/unresolved/{hash}.f.js`, where `hash`
      is computed from the original source-file bytes.
- [ ] Serialize and load the unchanged `Unresolved { imports, edag }` representation.
- [ ] Validate cached `Unresolved` schema and EDAG before reuse.
- [ ] Treat every cache read/parse/validation failure as a cache miss and recompile
      from source rather than failing the build.
- [ ] Reuse a valid cached `Unresolved` without parsing the source file.
- [ ] Parse/compile and create or replace the cache entry when it is missing/invalid.
- [ ] Bypass this cache when source maps are requested until a compatible cached
      source-map artifact is defined.
- [ ] Define compiler/EDAG-version cache invalidation outside the `Unresolved`
      structure.
- [ ] Ignore `.fjs/` cache artifacts in source control.
- [ ] Add proofs/tests for valid cache hits, malformed/truncated cache entries,
      cache miss after source changes, source-map-enabled builds, and
      compiler/EDAG-version invalidation.
- [ ] Keep the possible resolved-module second-level cache as future work until its
      identity and representation are designed.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — defines the unchanged
  temporary `Unresolved { imports, edag }` and resolves unresolved values into one
  final EDAG.
- [`investigate-edag-source-maps.md`](./investigate-edag-source-maps.md) — investigates
  source-map artifacts that must remain separate from EDAG.
