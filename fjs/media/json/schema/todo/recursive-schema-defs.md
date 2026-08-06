## Emit `$defs`/`$ref` for recursive schemas

**Priority:** P3
**Status:** open

### Problem

`toJsonSchema` walks an rtti `Type` eagerly and follows every thunk it meets,
so a schema that reaches itself never terminates. This is not hypothetical and
not specific to any one caller — the module's *own* `unknown` (the rtti schema
for a JSON Schema document, which recurses through `not`, `anyOf`, `items`,
`properties`, and `additionalProperties`) crashes it today:

```ts
toJsonSchema(unknown)                            // RangeError: Maximum call stack size exceeded
toJsonSchema(revisionLock)                       // RangeError, same reason
```

Nothing enforces the limit, so a recursive schema is a `RangeError` at the call
site rather than a typed failure. rtti's other consumers do not share the gap:
`validate` and `parse` instantiate a container's item walker only after finding
the container non-empty, which terminates the recursion at runtime.

The immediate consumer is `fjs/protocol/mcp`, which derives every tool's
`inputSchema` from its rtti argument schema. That is why `fjs/mcp/evo`'s
`evo_add` cannot advertise the revision `lock` argument: adding
`lock: option(lock)` to `evoAddArgs` would crash the server at registry
construction. So `evo_revision` returns a lock that `evo_add` cannot accept —
the one lossy step in an otherwise round-tripping API.

JSON Schema has the answer built in: draft 2020-12 names subschemas under
`$defs` and points at them with `$ref`, which is exactly how a recursive type
is expressed.

### Proposal

Give `toJsonSchema` a cycle-aware walk that emits `$ref` for a back edge and
collects the referenced bodies into a root-level `$defs`.

**Identity.** rtti thunks and const containers are objects, so reference
identity (`===`) is the only key available and the correct one: two structurally
identical schemas built separately are different definitions, and the same
thunk reached twice is the same one. Primitives cannot recurse and need no key.

**Walk.** Carry the set of `Type`s currently being expanded. Reaching a `Type`
already in that set is a back edge: emit `{ $ref: '#/$defs/<name>' }` and mark
it. After the walk, expand each marked schema's body once into `$defs` — its own
back edges become `$ref`s the same way. Only schemas that actually participate
in a cycle become definitions; an acyclic schema must keep producing exactly the
output it produces today, so every existing proof stands unchanged.

**Naming.** rtti schemas are anonymous — a thunk carries no name worth reading —
so generate `t0`, `t1`, … in discovery order. The walk is deterministic, so the
names are too. A caller-supplied name map is a possible later refinement and is
not needed to close this issue.

**Types.** `Unknown` (the module's JSON Schema document type) gains `$ref` and
`$defs`; `unknownConst` gains the matching rtti fields.

For the module's own `unknown`, the result is a document whose root is a
`$ref` into a single self-referential definition — the smallest end-to-end
proof that the producer can now describe the very format it emits.

Once this lands, `evoAddArgs` gains `lock: option(lock)` and the two
"not writable over MCP" caveats in `fjs/mcp/evo/module.f.ts` come out.

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
- [ ] Track in-progress schemas by reference identity during the walk and emit
      `$ref` on a back edge.
- [ ] Collect referenced bodies into a root-level `$defs`, naming them
      deterministically.
- [ ] Prove acyclic schemas are byte-identical to today's output.
- [ ] Prove `toJsonSchema(unknown)` — the module's own schema — terminates and
      emits a self-referential definition.
- [ ] Prove a mutually recursive pair (A → B → A) yields two definitions, not a
      duplicated body.
- [ ] Drop the "acyclic schemas only" caveat from `toJsonSchema`'s JSDoc.
- [ ] Add `lock: option(lock)` to `fjs/mcp/evo`'s `evoAddArgs` and remove the
      two caveats in that module's doc.

### Related

- [fjs/media/json/schema/module.f.ts](../module.f.ts) — the eager `visit`-driven
  walker, and the `unknown` schema that crashes it
- [fjs/protocol/mcp/module.f.ts](../../../../protocol/mcp/module.f.ts) — derives
  every tool `inputSchema` through `toJsonSchema`
- [fjs/mcp/evo/module.f.ts](../../../../mcp/evo/module.f.ts) — `evo_add`, blocked
  from advertising `lock` by this issue
- [fjs/media/revision/README.md](../../../revision/README.md#lock-map) — the
  recursive `lock` schema this first came up on
