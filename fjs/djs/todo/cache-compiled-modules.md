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

Source identity and compiler/cache identity belong to the cache machinery, not to
`Unresolved`.

### Cache layout

Hash the original source-file bytes with SHA-256 and encode the digest in CBase32:

```text
hash = CBase32(SHA256(source bytes))
```

Store the compiled unresolved value at:

```text
.fjs/unresolved/{hash}.f.js
```

The `.f.js` filename remains content-addressed by the original source file itself. The
cached value contains only the normal temporary `Unresolved { imports, edag }`; there
is no `hash`, source `path`, or compiler-version field inside `Unresolved`.

The cache files are build artifacts and must not be source-controlled.

### Compiler/cache identity

Source bytes alone are not sufficient to decide whether a cached compilation result is
reusable: a compiler semantic change or EDAG-format change can make an old artifact
stale even when the source hash is unchanged.

Define an explicit `cacheVersion` owned by the compiler. Bump it whenever a change can
alter source-to-`Unresolved` output or the accepted/serialized EDAG/cache format.

Keep the `.fjs/unresolved/{hash}.f.js` path unchanged and store a companion version
marker for each reusable entry, for example:

```text
.fjs/unresolved/{hash}.version
```

The marker contains the `cacheVersion` that produced the corresponding `.f.js` entry.
A lookup is a hit only when **both** files exist, the version marker exactly matches the
current compiler's `cacheVersion`, and the cached `Unresolved` parses and validates.
A missing or mismatched marker is a cache miss.

Write the `.f.js` artifact successfully before publishing/updating its version marker.
That ordering prevents a new version marker from blessing an older artifact when an
artifact write fails. The exact atomic-write/rename mechanism can follow the normal
cache implementation, but correctness must never depend on trusting an entry whose
matching version marker was not written for it.

### Incremental lookup

For a source module:

```text
source bytes
  -> SHA-256
  -> CBase32
  -> .fjs/unresolved/{hash}.f.js
     + .fjs/unresolved/{hash}.version
```

If the version marker matches the current `cacheVersion`, parse and validate the cached
`Unresolved`. Reuse `imports` and `edag` without parsing the source module only when
that cache artifact itself is valid.

Any cache read, version-check, parse, schema-validation, or EDAG-validation failure is
an ordinary **cache miss**. The compiler must fall back to parsing/compiling the
original source; a corrupt, truncated, manually modified, stale, or compiler-incompatible
cache artifact must not make the build fail merely because the cache exists.

If the cache entry is missing or invalid, parse/compile the source to an `Unresolved`
and attempt to save a replacement cache entry.

Cache writes are **best-effort**. Failure to create the cache directory, write or rename
the `.f.js` artifact, or write/publish the version marker must not turn a successful
source compilation into a compilation failure. Return the freshly compiled
`Unresolved`; the failed cache update merely means a later compilation may miss again.

Conceptually:

```text
source bytes
  -> hash
  -> matching-version valid cached Unresolved?
       |
       +-- yes -----------> reuse Unresolved
       |
       +-- no ------------> parse -> Unresolved -> best-effort cache
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
- [ ] Define the compiler-owned `cacheVersion` and exactly which semantic/EDAG/cache
      changes require it to be bumped.
- [ ] Store a matching `.fjs/unresolved/{hash}.version` companion marker and require
      it to match the current `cacheVersion` before an artifact can be reused.
- [ ] Publish/update the version marker only after the corresponding `.f.js` artifact
      write succeeds, so a failed write cannot validate an older artifact.
- [ ] Serialize and load the unchanged `Unresolved { imports, edag }` representation.
- [ ] Validate cached `Unresolved` schema and EDAG before reuse.
- [ ] Treat every cache read/version/parse/validation failure as a cache miss and
      recompile from source rather than failing the build.
- [ ] Reuse a valid, matching-version cached `Unresolved` without parsing the source
      file.
- [ ] Parse/compile when the entry is missing/invalid and attempt to create or replace
      the cache entry.
- [ ] Make every cache-directory/artifact/version-marker write failure non-fatal; return
      the freshly compiled `Unresolved` even when persistence fails.
- [ ] Bypass this cache when source maps are requested until a compatible cached
      source-map artifact is defined.
- [ ] Ignore `.fjs/` cache artifacts in source control.
- [ ] Add proofs/tests for valid cache hits, malformed/truncated cache entries,
      cache miss after source changes, missing/mismatched compiler versions, a compiler
      version bump with unchanged source bytes, read-only/unwritable cache locations,
      source-map-enabled builds, and failed cache writes that still return the freshly
      compiled result.
- [ ] Keep the possible resolved-module second-level cache as future work until its
      identity and representation are designed.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — defines the unchanged
  temporary `Unresolved { imports, edag }` and resolves unresolved values into one
  final EDAG.
- [`investigate-edag-source-maps.md`](./investigate-edag-source-maps.md) — investigates
  source-map artifacts that must remain separate from EDAG.
