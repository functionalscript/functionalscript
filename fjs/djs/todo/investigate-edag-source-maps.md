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

Questions to answer:

1. **How should a sidecar source map identify an EDAG node?**
   Possible approaches include a deterministic node ordinal derived while
   serializing the DAG, a location in the canonical DJS serialization, or another
   identifier derivable from the EDAG without storing metadata inside it.

2. **Can the standard JavaScript Source Map format be reused?**
   Since compiled EDAGs may be emitted as DJS files, a normal source map could map
   positions in that generated DJS text back to the source module. Determine whether
   mapping each uniquely serialized/shared EDAG node by its generated DJS position
   is sufficient, or whether graph-specific metadata is required.

3. **How should sharing and references be represented?**
   A DJS serialization can emit a shared EDAG node once as a `const` and refer to it
   elsewhere. Determine whether the source map should map only the defining node,
   each reference occurrence, or both.

4. **How stable does the mapping need to be?**
   Determine whether source metadata is valid only for one exact serialized EDAG
   artifact or whether it should survive deterministic reserialization. The source
   map itself must not participate in EDAG identity/hash.

5. **Where should source-map artifacts live?**
   Coordinate with the module-to-EDAG compilation task: if EDAGs are emitted under
   `./.fjs/edag/`, consider adjacent sidecars such as `*.map` or a separate
   `./.fjs/source-map/` directory. These are temporary compiler artifacts and are
   not source-controlled.

6. **What metadata is required initially?**
   Start with the minimum needed for diagnostics: source file and source range
   (line/column or byte/UTF-16 offsets). Names, scopes, comments, and richer debugger
   information can be deferred.

### Constraints

- Do not add source locations, generated node IDs, or debugging fields to EDAG nodes.
- Do not make source metadata part of EDAG serialization or content identity.
- Preserve semantic sharing: structurally equal but distinct nodes must not collapse
  to one source-map entry merely because their contents are equal.
- The design should work with EDAG serialized as DJS and should remain extensible as
  the EDAG operation set grows.

### Tasks

- [ ] Prototype mapping a compiled module EDAG to a separate source-map artifact.
- [ ] Evaluate standard Source Map v3 against the DJS serialization approach.
- [ ] Define how shared EDAG nodes and reference occurrences map to source ranges.
- [ ] Determine a stable external node-addressing scheme that requires no metadata in
      EDAG nodes.
- [ ] Decide the sidecar file format, naming, and placement under the FunctionalScript
      temporary build directory.
- [ ] Add a small example showing source module -> EDAG DJS -> separate source map ->
      recovered original location for an EDAG node.
- [ ] Record the chosen design in the relevant compiler/EDAG documentation before
      implementing full debugger/source-map support.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — compiles modules to
  cacheable EDAGs before loading imports and may emit those EDAGs as DJS build
  artifacts.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG sharing and node-identity semantics.
- [`../../../todo/edag-spec.md`](../../../todo/edag-spec.md) — future canonical EDAG
  schema; source metadata must stay outside that canonical value.
