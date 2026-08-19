## Investigate EDAG source maps

**Priority:** P3
**Status:** open

### Problem

When a FunctionalScript module is compiled to EDAG, debugging and diagnostics need
to relate EDAG nodes back to the original source locations.

The source metadata must **not** be embedded into the EDAG itself. EDAG is the
canonical computation representation: adding file names, line/column ranges, node
IDs, or other debug metadata would change its serialized form and therefore its
identity/hash even though the computation is unchanged.

The source map therefore has to be a separate artifact associated with the EDAG.
The difficult part is identifying EDAG nodes from that sidecar metadata without
changing the EDAG representation.

EDAG sharing makes this more subtle than mapping an ordinary syntax tree:

- two references to the same EDAG node are semantically shared;
- two structurally equal but independently constructed nodes are semantically
  distinct;
- one shared node may be reachable through several graph paths;
- a source location may describe either the expression that created a node or a
  particular source reference to an already shared value.

A source-map scheme must preserve these distinctions.

### Investigation

Investigate a separate source-map representation for compiled EDAGs.

#### Candidate: EDAG array paths

Because EDAG operations are represented as arrays, traversal can naturally maintain a
path from the EDAG root using array indexes. For example:

```js
[1, 3, 5]
```

means: take element `1` of the root array, then element `3`, then element `5`.
Conceptually this is similar to a JSON path specialized to the EDAG representation.

A source map could use such paths as indexes into source metadata. An interpreter,
validator, serializer, or other EDAG traversal already knows which child it is visiting,
so it can carry the current path in parallel with traversal without adding metadata to
the EDAG itself.

This raises an important sharing question rather than resolving it: in a DAG, one
shared node may be reachable through multiple paths. A path therefore naturally
identifies a traversal occurrence/reference from the root, not necessarily a unique
node identity. The source-map design must decide how paths for shared definitions and
shared references relate to each other.

EDAG transformations also need source-map composition. If compilation/linking combines
several EDAGs or constructs a new EDAG from existing EDAGs, the corresponding source
map may need to be constructed/transformed **in parallel** so its paths describe the
new EDAG. Do not assume a source map for an input EDAG remains valid after the EDAG is
embedded, reordered, or otherwise transformed.

Questions to answer:

1. **Can EDAG array paths be the primary source-map index?**
   Investigate paths such as `[1, 3, 5]` as the simplest external addressing scheme.
   Determine whether they are sufficient for diagnostics, execution/traversal, DJS
   serialization, and shared-node references.

2. **How should sharing and multiple paths be represented?**
   The same EDAG node can be reachable through more than one path. Determine whether
   mappings are attached to occurrences/paths, whether one path is treated specially
   as the defining occurrence, or whether additional graph-specific information is
   required.

3. **How should source maps be transformed when EDAGs are combined?**
   Module resolution and later EDAG transformations can create a new EDAG from one or
   more existing EDAGs. Determine how the new EDAG and its new source map are produced
   together so every retained/moved/new node occurrence receives the appropriate new
   path and source provenance.

4. **Can the standard JavaScript Source Map format be reused?**
   Since final EDAGs may be serialized as `.f.js`, a normal source map could map
   positions in that generated DJS text back to the source modules. Determine whether
   EDAG-path mappings can be converted to Source Map v3 during serialization, or
   whether graph-specific metadata is required in addition to a standard source map.

5. **How stable does the mapping need to be?**
   Determine whether source metadata is valid only for one exact EDAG structure or
   serialized artifact, or whether some mapping can survive deterministic
   reserialization. The source map itself must not participate in EDAG identity/hash.

6. **Where should source-map artifacts live?**
   Coordinate with the final EDAG output, not the temporary unresolved cache. A final
   `<name>.f.js` could use an adjacent `<name>.f.js.map`, or source maps could live in
   a separate FunctionalScript-owned directory such as
   `./.fjs/source-map/`.

   The existing `./.fjs/unresolved/{hash}.f.js` path is a cache of temporary
   `Unresolved { imports, edag }` values, not a directory of final EDAG artifacts, so
   it should not be treated as the final source-map location.

7. **How should source maps interact with the unresolved cache?**
   The source-to-`Unresolved` cache can skip parsing and therefore does not
   automatically reconstruct source ranges. Until a compatible cached source-map
   artifact is designed, compilation that requests source maps should bypass that
   cache and parse the source normally. Investigate whether an `Unresolved` mapping
   sidecar can later make warm and cold builds produce equivalent source mappings.

8. **What metadata is required initially?**
   Start with the minimum needed for diagnostics: source file and source range
   (line/column or byte/UTF-16 offsets). Names, scopes, comments, and richer debugger
   information can be deferred.

### Constraints

- Do not add source locations, generated node IDs, or debugging fields to EDAG nodes.
- Do not make source metadata part of EDAG serialization or content identity.
- Preserve semantic sharing: structurally equal but distinct nodes must not collapse
  to one source-map entry merely because their contents are equal.
- Treat an EDAG path as an external structural/traversal address; do not assume it is
  an intrinsic identity for a shared DAG node.
- When an operation constructs or combines EDAGs, keep source-map transformation in
  step with the EDAG transformation rather than reusing stale paths.
- Warm builds must not silently lose source-map information compared with cold builds.
- The design should work with EDAG serialized as DJS and should remain extensible as
  the EDAG operation set grows.

### Tasks

- [ ] Prototype an EDAG source map indexed by array paths such as `[1, 3, 5]`.
- [ ] Carry the current EDAG path during a simple traversal and recover source metadata
      for the visited occurrence.
- [ ] Define how shared EDAG nodes and multiple reference paths map to source ranges.
- [ ] Prototype combining/transforming EDAGs while constructing the corresponding new
      source map in parallel.
- [ ] Evaluate standard Source Map v3 against EDAG-path mappings and the final `.f.js`
      DJS serialization.
- [ ] Decide whether source-map sidecars are adjacent to final `.f.js` output or live
      under a separate FunctionalScript build directory.
- [ ] Investigate a compatible source-map cache for `Unresolved`; until then, require
      source-map-enabled builds to bypass the `.fjs/unresolved/{hash}.f.js` cache.
- [ ] Add a small example showing source modules -> EDAG + path-indexed source map ->
      transformed/combined EDAG + transformed source map -> final EDAG DJS.
- [ ] Add a warm-vs-cold build proof showing source mappings are equivalent once cache
      reuse for source-map-enabled builds is supported.
- [ ] Record the chosen design in the relevant compiler/EDAG documentation before
      implementing full debugger/source-map support.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — resolves source
  modules into one final EDAG and serializes it to `.f.js` or JSON when representable.
- [`cache-compiled-modules.md`](./cache-compiled-modules.md) — caches temporary
  `Unresolved { imports, edag }` values under `.fjs/unresolved/` and currently bypasses
  that cache when source maps are requested.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG sharing and node-identity semantics.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — future canonical EDAG
  schema; source metadata must stay outside that canonical value.
