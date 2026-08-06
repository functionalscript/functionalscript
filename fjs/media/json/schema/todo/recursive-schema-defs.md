## Emit `$defs`/`$ref` for recursive schemas

**Priority:** P3
**Status:** blocked
**Blocked by:** [Serializable data form](../../../../types/rtti/todo/data-form.md)

### Problem

`toJsonSchema` walks an rtti `Type` eagerly and follows every thunk it meets,
so a schema that reaches itself never terminates. This is not hypothetical and
not specific to any one caller — the module's *own* `unknown` (the rtti schema
for a JSON Schema document, which recurses through `not`, `anyOf`, `items`,
`properties`, and `additionalProperties`) crashes it today:

```ts
toJsonSchema(unknown)   // RangeError: Maximum call stack size exceeded
```

Nothing enforces the limit, so a recursive schema is a `RangeError` at the call
site rather than a typed failure. rtti's other consumers do not share the gap:
`validate` and `parse` instantiate a container's item walker only after finding
the container non-empty, which terminates the recursion at runtime.

The immediate consumer is `fjs/protocol/mcp`, which derives every tool's
`inputSchema` from its rtti argument schema. That is why `fjs/mcp/evo`'s
`evo_add` cannot *advertise* the revision `lock` argument: a recursive schema
for it would crash the server at registry construction. `evo_add` accepts and
validates a lock regardless — rtti passes undeclared keys through — so the cost
is discoverability, not correctness.

JSON Schema has the answer built in: draft 2020-12 names subschemas under
`$defs` and points at them with `$ref`, which is exactly how a recursive type
is expressed.

### Proposal

**Build this on the rtti data form, do not grow a cycle detector here.**
Naming a cyclic schema's nodes so they can be written down is not a JSON Schema
problem — it is the whole job of
[`fjs/types/rtti/todo/data-form.md`](../../../../types/rtti/todo/data-form.md),
which is in turn `fjs/bnf/data`'s `toDataAdd` applied to the `Type` ADT:
reference-identity lookup, register-before-recurse to break the cycle,
`.name`-derived identifiers with numeric de-duplication. `printer` in
`fjs/types/rtti/ts` needs exactly the same thing for exactly the same reason, so
a detector written into this module would be the second of three copies.

Once `toData` exists this consumer is close to mechanical:

- the data form's flat node map becomes `$defs`;
- its entry id becomes the document root — a `$ref` when the root is itself
  recursive, the inlined body otherwise;
- each node reference becomes `{ $ref: '#/$defs/<name>' }`;
- an acyclic schema must still produce exactly today's output, byte for byte,
  so every existing proof stands unchanged.

**Types.** `Unknown` (the module's JSON Schema document type) gains `$ref` and
`$defs`; `unknownConst` gains the matching rtti fields. This part is
independent of the data form and can land first.

For the module's own `unknown`, the result is a document whose root is a
`$ref` into a single self-referential definition — the smallest end-to-end
proof that the producer can now describe the very format it emits.

Once this lands, `evoAddArgs` can advertise `lock` and the "unlisted but
accepted" caveats in `fjs/mcp/evo/module.f.ts` come out. That is a
discoverability fix: `evo_add` already accepts and validates a lock.

### Out of scope

- `fjs/types/rtti/ts`'s `printer`, which has the same eager-walk limitation for
  a different output (a TypeScript type expression string). Expressing recursion
  there needs a named type alias plus a reference, not `$defs` — a separate
  mechanism for a separate consumer.
- `$id`, `$anchor`, remote references, and any `$ref` target outside the emitted
  document.
- A caller-supplied `$defs` naming scheme.

### Tasks

- [ ] Add `$ref` and `$defs` to `Unknown` and `unknownConst`.
- [ ] Re-express `toJsonSchema` over the rtti data form: node map → `$defs`,
      entry id → document root, node reference → `$ref`.
- [ ] Prove acyclic schemas are byte-identical to today's output.
- [ ] Prove `toJsonSchema(unknown)` — the module's own schema — terminates and
      emits a self-referential definition.
- [ ] Prove a mutually recursive pair (A → B → A) yields two definitions, not a
      duplicated body.
- [ ] Drop the "acyclic schemas only" caveat from `toJsonSchema`'s JSDoc.
- [ ] Advertise `lock` in `fjs/mcp/evo`'s `evoAddArgs` and remove the
      "unlisted but accepted" caveats in that module's doc.

### Related

- [fjs/media/json/schema/module.f.ts](../module.f.ts) — the eager `visit`-driven
  walker, and the `unknown` schema that crashes it
- [fjs/protocol/mcp/module.f.ts](../../../../protocol/mcp/module.f.ts) — derives
  every tool `inputSchema` through `toJsonSchema`
- [fjs/mcp/evo/module.f.ts](../../../../mcp/evo/module.f.ts) — `evo_add`, blocked
  from advertising `lock` by this issue
- [fjs/media/revision/README.md](../../../revision/README.md#lock-map) — the
  recursive `lock` shape this first came up on
- [fjs/types/rtti/todo/data-form.md](../../../../types/rtti/todo/data-form.md)
  — the naming/reference machinery this waits on; `fjs/types/rtti/ts`'s
  `printer` is the other consumer waiting on the same thing
