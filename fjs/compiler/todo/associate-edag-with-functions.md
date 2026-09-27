## Associate compiled functions with their EDAG

**Priority:** P4
**Status:** on-hold

### Problem

An EDAG does not have to be interpreted directly. A compiler may instead compile an
EDAG to a normal executable function and run that function using the host engine or a
VM.

Conceptually:

```text
EDAG
  -> compile to Function
  -> execute Function
```

That path is attractive because normal function execution can use the existing runtime
and optimization machinery. However, compiling the EDAG away creates a reverse-lookup
problem: if later code receives only the resulting `Function` and needs its EDAG, the
association must survive compilation. It can be retained with the function value
or through a separate lookup; the representation remains open.

### Proposal

The [MVP roadmap](../../../nanvm-lib/todo/mvp-roadmap.md#open-questions) and
[callable-function-objects](../../../nanvm-lib/todo/callable-function-objects.md)
Stage 7 require semantic EDAG association while leaving its storage open:

- **Embedded metadata:** retain the semantic EDAG with the function value.
- **Lookup:** associate the callable with its EDAG through a runtime registry.

The Effects below are a candidate interface for lookup, not a selected API or
a prohibition on embedded metadata:

```ts
['edagAdd', (e: EDAG, f: Function) => Result<void, unknown>]
['edagGet', (f: Function) => Result<EDAG, unknown>]
```

Under that candidate, `edagAdd` registers that `f` was compiled from `e`.
`edagGet` retrieves the EDAG associated with a function when one is available.

This keeps the compiler independent from how a particular runtime stores the
association. The EDAG remains its own computation representation; the function can
remain an ordinary executable value.

Neither storage choice requires the optional
[Rust EDAG executor](../../../todo/rust-edag.md). Direct AOT functions may retain
semantic metadata without depending on a dynamic execution library.

### Runtime implementations

If lookup is selected, a VM may implement these Effects directly. For example,
NaNVM can register the EDAG when it creates a function and later answer `edagGet`
from its internal function metadata or function table.

A JavaScript-based runtime could use a separate function-to-EDAG registry instead.
The concrete storage mechanism is runtime-specific and is deliberately not part of
the Effect contract.

The important semantic distinction is:

```text
EDAG -> Function        compilation/execution concern
Function -> EDAG        metadata/association concern
```

The second direction retrieves retained semantic EDAG, not a reconstruction by
decompiling the function. Under the lookup candidate, if no EDAG was registered
or the runtime cannot provide one, `edagGet` returns an error.

### Open problem: nested functions and frames

The association is less obvious for functions created dynamically from nested
functions/closures, because the resulting function value may depend on a captured
frame.

For example:

```js
const f = a => b => a + b
const g = f(2)
```

`g` is a new function value created by evaluating `f`, with `a` captured in its
frame. If later code calls `edagGet(g)`, it is not yet specified what EDAG should have
been registered for `g`, when that registration should happen, or how the captured
frame participates in that association.

Neither embedded metadata nor lookup by itself settles that question. This note
intentionally does **not** choose a representation or solve the problem. Nested
functions, closure creation, and frames must be considered before the association
contract, including `edagAdd` / `edagGet` if selected, can be treated as complete.

### Notes

- Do not require every function to have an EDAG. Host/native functions may have no
  registered EDAG.
- Embedded metadata versus lookup is the same open choice in this note, the
  roadmap and Stage 7. Choose the representation before implementing the
  association; none of those documents mandates embedding or a registry.
- The association should preserve the exact EDAG, including semantic node sharing;
  retrieval is not regeneration or normalization.
- This mechanism can coexist with direct EDAG interpretation. A runtime may interpret
  EDAGs, compile them to functions, or use both strategies.
- If a registry is selected, its lifetime/identity rules are runtime-specific and
  can be decided when an implementation needs them.

### Tasks

- [ ] Choose embedded metadata or lookup, including the handling of unavailable
      metadata. If lookup Effects are selected, decide their type definitions
      and module location.
- [ ] Decide how nested functions/closures and captured frames participate in
      the chosen function-to-EDAG association.
- [ ] Implement the selected association when a metadata consumer needs it,
      keeping direct AOT independent of the optional Rust EDAG executor.
- [ ] Prove retrieval preserves the associated EDAG and its semantic sharing,
      including closures. If `edagAdd` / `edagGet` are selected, prove the
      registration/retrieval pair and its error for an unregistered function.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — compiles DJS modules
  to EDAG before loading imported values.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG semantics and function representation design.
- [MVP roadmap](../../../nanvm-lib/todo/mvp-roadmap.md#open-questions) — the
  same open embedded-metadata versus lookup choice, separate from execution.
