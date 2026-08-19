## Associate compiled functions with their EDAG

**Priority:** P4
**Status:** on-hold

### Idea

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
association must be preserved somewhere outside the function value itself.

### Effects

Represent that association through Effects rather than baking EDAG metadata into the
function representation:

```ts
['edagAdd', (e: EDAG, f: Function) => Result<void, unknown>]
['edagGet', (f: Function) => Result<EDAG, unknown>]
```

`edagAdd` registers that `f` was compiled from `e`. `edagGet` retrieves the EDAG
associated with a function when one is available.

This keeps the compiler independent from how a particular runtime stores the
association. The EDAG remains its own computation representation; the function can
remain an ordinary executable value.

### Runtime implementations

A VM may implement these Effects directly. For example, NaNVM can register the EDAG
when it creates/compiles a function and later answer `edagGet` from its internal
function metadata or function table.

A JavaScript-based runtime could use a separate function-to-EDAG registry instead.
The concrete storage mechanism is runtime-specific and is deliberately not part of
the Effect contract.

The important semantic distinction is:

```text
EDAG -> Function        compilation/execution concern
Function -> EDAG        metadata/association concern
```

The second direction is not expected to reconstruct an EDAG by decompiling the
function. It retrieves the EDAG that was registered for that function. If no EDAG was
registered, or the runtime cannot provide one, `edagGet` returns an error.

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

This note intentionally does **not** choose a representation or solve the problem.
Nested functions, closure creation, and frames must be considered before the
`edagAdd` / `edagGet` contract can be treated as complete.

### Notes

- Do not require every function to have an EDAG. Host/native functions may have no
  registered EDAG.
- Do not embed the EDAG into the function merely to support lookup; the Effect exists
  so runtimes can choose an appropriate external/internal registry.
- The association should preserve the exact EDAG, including semantic node sharing;
  `edagGet` is retrieval, not regeneration or normalization.
- This mechanism can coexist with direct EDAG interpretation. A runtime may interpret
  EDAGs, compile them to functions, or use both strategies.
- The lifetime/identity rules of the registry are runtime-specific and can be decided
  when an implementation needs them.

### Possible future work

- [ ] Decide the canonical Effect type definitions and module location.
- [ ] Decide how nested functions/closures and captured frames participate in
      function-to-EDAG registration.
- [ ] Implement `edagAdd` / `edagGet` in a runtime when function-to-EDAG lookup is
      needed.
- [ ] Consider a NaNVM implementation that stores the EDAG alongside its internal
      function representation.
- [ ] Add proofs that `edagGet(f)` returns the same EDAG previously registered with
      `edagAdd(edag, f)` and reports an error for an unregistered function.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — compiles DJS modules
  to EDAG before loading imported values.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG semantics and function representation design.
