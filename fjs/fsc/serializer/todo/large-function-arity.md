## Refuse function arities the writer cannot represent

**Priority:** P2
**Status:** open

### Problem

The EDAG `['=>', 2 ** 32, null, 1]` has valid length metadata and passes
binding analysis. The source writer's `entry` function allocates its fixed
parameter names with `Array.from({ length }, ...)`, which throws
`RangeError: Invalid array length` for this input.

Reproduced at `f2a98b0c` and again at `5affe40a`: `trySerialize` and `tryStringify` throw instead of
returning an error Result. `tryModuleSerialize` and `tryModuleStringify` also
throw when the function is the default export of a module graph.

This is a deferred corner-case crash, not a successful serialization or an
invalid EDAG. The JavaScript executor's factory-table capacity does not bound
the source writer. Smaller lengths can also exhaust writer resources; this
report does not claim that every length below `2 ** 32` is practical.

### Tasks

- [ ] Define and document the writer's own representability/resource boundary,
      independently of the executor table and EDAG validity.
- [ ] Return an error Result for the reported input, either by refusing the
      unsupported length before allocation or by changing parameter production
      with an explicit resource policy. Avoid constructing an enormous array
      merely to determine that the output cannot be produced.
- [ ] Add proofs for all four public writer entry points and nested function
      graphs. Check supported arities above the executor-table boundary still
      round-trip; test refusal without allocating billions of parameters.

### Related

- [PR #2237 review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097887854)
  — the reported crash and accepted co-located TODO follow-up.
- [Follow-up review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4099657145)
  — restore this tracking after it was omitted from the rewritten branch.
- [Source writer](../module.f.mjs) — `entry` constructs parameter names.
- [Parameter plan](../../../../spec/todo/3120-parameters.md)
  — source writing and executor capacities are independent.
