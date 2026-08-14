## Recursive RTTI to JSON Schema

**Priority:** P3
**Status:** blocked

### Problem

[`toJsonSchema`](../schema/module.f.mjs) currently walks thunk-based RTTI directly.
That works for finite trees, but recursive RTTI values are graphs:

```ts
const lock = () => ['record', or(string, lock)] as const
```

Following this thunk never reaches a leaf. Recursive consumers therefore need a
shared, finite RTTI graph representation rather than transformer-specific thunk
identity tracking.

### Depends on

- [RTTI serializable data form](../../../types/rtti/data/README.md) — landed;
  it defines the function-free rule set and named references used to represent
  recursion. This task must consume that representation.

A name-keyed rule set is an open map because a reference may name a missing
definition:

```ts
type TypeDataSet = StringMap<TypeData>
type TypeData = /* finite data nodes containing definition references */
```

Equivalently:

```ts
type TypeDataSet = {
    readonly [name: string]: TypeData | undefined
}
```

Do not use `Readonly<Record<string, TypeData>>`; it incorrectly types every
possible lookup as present.

### Proposal

Add a data-driven transformer:

```ts
dataToJsonSchema(data)
```

Keep the ergonomic public entry point, but route it through RTTI data:

```text
thunk RTTI -> toData -> dataToJsonSchema -> JSON Schema
```

Emit recursive and shared definitions with JSON Schema draft 2020-12 `$defs`
and `$ref`:

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

Graph discovery, canonical identity, and definition naming belong to the RTTI
data layer. The JSON Schema module only translates the finite graph.

### Reference encoding

A local `$ref` is a URI fragment containing a JSON Pointer. Definition names
must therefore be encoded in two steps:

1. JSON Pointer escaping: `~` becomes `~0`, and `/` becomes `~1`.
2. Percent-encoding for the URI-fragment path segment.

Apply percent-encoding **after** JSON Pointer escaping. For example, a literal
definition name `%2F` must not be emitted as `#/$defs/%2F`, because URI-fragment
decoding would turn it into `/` before JSON Pointer evaluation. It must be
encoded so URI decoding restores the literal `%2F` segment.

The implementation may avoid this complexity only if the RTTI data format
formally restricts generated names to a URI-fragment-safe alphabet. Arbitrary
external names still require the two-step encoding above.

### Reference rules

- Emit every recursive or shared definition exactly once under `$defs`.
- Emit graph edges as `$ref`, never by recursively expanding definitions.
- Self-recursion and mutual recursion must terminate.
- Definition names must be deterministic for the same canonical RTTI data.
- The root uses `$ref` when represented by a named/indexed definition.
- A missing referenced definition is an error.
- Non-recursive finite RTTI preserves current JSON Schema semantics.

### JSON Schema RTTI

Extend the module's emitted-schema `Unknown` RTTI/type with the reference fields
that this transformer emits:

```ts
type Unknown = {
    readonly $schema?: string
    readonly $ref?: string
    readonly $defs?: StringMap<Unknown>
    // existing emitted keywords
}
```

Equivalently, `$defs` is an optional open index:

```ts
readonly $defs?: {
    readonly [name: string]: Unknown | undefined
}
```

Do not use `Readonly<Record<string, Unknown>>`; an absent `$defs` entry must be
typed as `undefined` so missing-reference handling cannot be skipped.

Keep this RTTI limited to keywords emitted by this module. This task does not
implement the complete JSON Schema meta-schema.

### Compatibility

The public `toJsonSchema(rtti)` signature can remain unchanged. Finite schemas
should produce equivalent output except where the shared RTTI data
representation requires a `$defs`/`$ref` wrapper.

Prefer deterministic output over preserving incidental thunk traversal order.
Update proofs and MCP schema snapshots for intentional output-shape changes.

### Tasks

- [x] Complete the blocking RTTI serializable-data task
      ([`fjs/types/rtti/data`](../../../types/rtti/data/README.md)).
- [ ] Add `dataToJsonSchema` over the RTTI data rule set.
- [ ] Treat name-keyed RTTI definitions as `StringMap<TypeData>` and explicitly
      reject absent referenced definitions.
- [ ] Change `toJsonSchema(rtti)` to call `toData` and then
      `dataToJsonSchema`.
- [ ] Emit definitions under `$defs` and graph edges as local `$ref` values.
- [ ] Implement deterministic definition naming.
- [ ] Escape each definition name as a JSON Pointer segment and then
      percent-encode it for the URI fragment.
- [ ] Extend emitted-schema `Unknown` with `$schema`, `$ref`, and
      `$defs?: StringMap<Unknown>`.
- [ ] Preserve existing output semantics for primitives, structs, tuples,
      arrays, records, unions, constants, optionals, and `unknown`.
- [ ] Add proofs for self-recursion, mutual recursion, recursive records,
      recursive arrays/unions, and shared non-recursive definitions.
- [ ] Add proofs for missing definitions and missing `$defs` lookups.
- [ ] Add reference-encoding proofs for names containing `~`, `/`, `%2F`,
      spaces, and non-ASCII characters.
- [ ] Add a proof for the recursive revision lock schema:
      `() => ['record', or(string, lock)] as const`.
- [ ] Update MCP schema proofs/snapshots that contain `$defs` and `$ref`.

### Out of scope

- A second RTTI graph representation inside the JSON Schema module.
- A complete JSON Schema validator or draft 2020-12 meta-schema.
- Remote `$ref` resolution.
- Resolver semantics for revision lock maps.
- Replacing the thunk-direct RTTI validator/parser.

### Dependents

- [`fjs/media/todo/revision-lock-map.md`](../../todo/revision-lock-map.md),
  Stage 2.

### Related

- [RTTI serializable data form](../../../types/rtti/data/README.md)
- [`fjs/bnf/data`](../../../bnf/data/)
- [`fjs/media/json/schema/module.f.mjs`](../schema/module.f.mjs)
- [`fjs/protocol/mcp`](../../../protocol/mcp/)
