## Recursive RTTI to JSON Schema

**Priority:** P3
**Status:** open

### Problem

[`toJsonSchema`](../schema/module.f.ts) currently converts the thunk-based RTTI
`Type` directly by walking it with `fjs/types/rtti/common`'s `visit`.

That works for finite trees, but recursive RTTI values are graphs. For example:

```ts
const lock = () => ['record', or(string, lock)]
```

Following `lock` recursively does not reach a leaf, so the current transformer
cannot produce JSON Schema for it. This blocks consumers that expose RTTI as
JSON Schema, including MCP tool input/output schemas.

Do not solve this by adding ad-hoc thunk identity tracking to only the JSON
Schema transformer. RTTI needs one shared serializable graph representation so
all consumers resolve recursion in the same way.

### Blocked by

- [RTTI serializable data representation](../../../types/rtti/todo/serializable-data.md)

The blocker proposes a function-free RTTI data representation modeled after
[`fjs/bnf/data`](../../../bnf/data/).

It includes the required recursion model: definitions are stored in a named or
indexed rule set, and nested types refer to those definitions instead of
containing self-referencing functions.

Conceptually:

```ts
type TypeDataSet = Readonly<Record<TypeName, TypeData>>
type TypeData = /* finite data nodes containing TypeName references */
```

The concrete shape and naming policy belong to the RTTI data TODO. This task
must consume that shared representation rather than invent a second graph
encoding specific to JSON Schema.

### Proposal

Add a data-driven JSON Schema transformer that converts an RTTI data rule set
into JSON Schema draft 2020-12 using `$defs` and `$ref`.

Conceptually:

```json
{
  "$ref": "#/$defs/lock",
  "$defs": {
    "lock": {
      "type": "object",
      "additionalProperties": {
        "anyOf": [
          { "type": "string" },
          { "$ref": "#/$defs/lock" }
        ]
      }
    }
  }
}
```

The exact emitted definition names should come from the RTTI data
representation. The JSON Schema layer only translates those stable references
into local JSON Pointer references.

Keep the ergonomic thunk API:

```ts
toJsonSchema(rtti)
```

but implement it as a bridge through RTTI data:

```text
thunk RTTI -> toData -> dataToJsonSchema -> JSON Schema
```

Also expose the data-level transformation when useful:

```ts
dataToJsonSchema(data)
```

This keeps graph discovery, naming, recursion handling, and canonical identity
in the RTTI data layer, while the JSON Schema module only performs format
translation.

### Reference rules

- Every recursive or shared RTTI definition is emitted once under `$defs`.
- Nested uses emit `$ref` rather than recursively expanding the definition.
- Self-recursion and mutual recursion must both terminate.
- Definition names must be deterministic for the same canonical RTTI data.
- Names used in JSON Pointer fragments must be escaped correctly (`~` as `~0`
  and `/` as `~1`).
- A reference to an unknown RTTI definition is an error, not an empty or
  permissive JSON Schema.
- The root schema points to the selected root definition with `$ref` when the
  root is represented by a named/indexed data rule.
- Non-recursive finite RTTI must preserve the current JSON Schema semantics.

### JSON Schema RTTI

The module's own `Unknown` RTTI currently describes only the subset emitted by
the finite-tree transformer. Extend it to support the reference form emitted by
this task, including at least:

```ts
{
    $schema?: string
    $ref?: string
    $defs?: Readonly<Record<string, Unknown>>
}
```

Keep the representation limited to keywords actually emitted by this module.
Do not turn this task into a complete JSON Schema meta-schema implementation.

### Compatibility

The current public entry point can keep its name and input type. Finite schemas
should continue to produce equivalent output, except where wrapping the root in
`$defs`/`$ref` is required by the shared RTTI data representation.

Prefer deterministic output over preserving incidental recursive-thunk traversal
order. Any intentional output-shape change must be reflected in proofs and MCP
schema snapshots.

### Tasks

- [ ] Add `dataToJsonSchema` over the RTTI data rule set.
- [ ] Change `toJsonSchema(rtti)` to call RTTI `toData` and then
      `dataToJsonSchema`.
- [ ] Emit definitions under `$defs` and graph edges as local `$ref` values.
- [ ] Implement deterministic definition naming and JSON Pointer escaping.
- [ ] Detect and report missing/invalid data references.
- [ ] Extend the emitted-JSON-Schema `Unknown` RTTI/type with `$schema`, `$ref`,
      and `$defs` as needed.
- [ ] Preserve existing output semantics for primitives, structs, tuples,
      arrays, records, unions, constants, optionals, and `unknown`.
- [ ] Add proofs for direct self-recursion, mutual recursion, recursive records,
      recursive arrays/unions, and shared non-recursive definitions.
- [ ] Add a proof for the recursive revision lock schema:
      `() => ['record', or(string, lock)]`.
- [ ] Update MCP schema proofs/snapshots that now contain `$defs` and `$ref`.
- [ ] Document the dependency for recursive schema consumers.

### Out of scope

- Designing a second RTTI graph representation inside the JSON Schema module.
- A complete JSON Schema validator or complete draft 2020-12 meta-schema.
- Remote `$ref` resolution.
- Resolver semantics for revision lock maps.
- Changing the thunk-direct RTTI validator/parser solely to support this
  transformer.

### Dependents

- [`fjs/media/todo/revision-lock-map.md`](../../todo/revision-lock-map.md),
  Stage 2 — recursive lock maps require recursive JSON Schema generation for
  Evo/MCP schemas.

### Related

- [RTTI serializable data representation](../../../types/rtti/todo/serializable-data.md)
  — named/indexed recursion shared by RTTI consumers
- [`fjs/bnf/data`](../../../bnf/data/) — existing function-free grammar data
  representation used as the architectural model
- [`fjs/media/json/schema/module.f.ts`](../schema/module.f.ts) — current
  finite-tree RTTI transformer
- [`fjs/protocol/mcp`](../../../protocol/mcp/) — consumer of generated JSON
  Schemas for tool contracts
