## 668-rtti-function-types. Add RTTI support for function values

**Priority:** P3
**Status:** open

### Problem

RTTI can describe data shapes, but it cannot currently describe function values
as first-class schemas. Some consumers need to express a callable value together
with its parameter and result types, for example emergent testing proof leaves.

Function RTTI has an important limitation: while we can describe the parameter
and result types, runtime validation of a function itself has limited options.
A value can be checked as callable, but its full contract can only be observed
when the function is called.

### Proposal

Add an extern RTTI form for functions. It should be able to describe parameter
types and result type, while keeping the runtime contract explicit: validating a
function schema should not pretend it can prove all future calls are valid.

One practical API is a wrapper that validates calls:

```ts
validateFunc<F extends RttiFunction>(
    rtti: F,
    f: (...params: readonly unknown[]) => unknown,
): (...params: TsParams<F>) => Result<TsResult<F>, unknown>
```

The wrapper validates parameters before calling `f` and validates the result
after the call. Errors from validation or from the function body are returned as
`Result` errors.

For untrusted code, provide a sandboxed wrapper:

```ts
validateSandboxFunc<F extends RttiFunction>(
    rtti: F,
    f: (...params: readonly unknown[]) => unknown,
): (...params: TsParams<F>) => Effect<Sandbox, Result<TsResult<F>, unknown>>
```

This preserves the same typed call surface while running the function through a
sandbox effect, which is better for cases where the function body should not be
trusted.

### Tasks

- [ ] Design the extern RTTI representation for function schemas.
- [ ] Define `TsParams<F>` and `TsResult<F>` for function RTTI.
- [ ] Decide what minimal validation is performed on the raw value before it is
  wrapped.
- [ ] Add a call-validating wrapper that returns `Result<TsResult<F>, unknown>`.
- [ ] Add or design a sandboxed wrapper that returns
  `Effect<Sandbox, Result<TsResult<F>, unknown>>`.
- [ ] Document the runtime limitation: function RTTI describes callable
  contracts, but the contract is enforced at call boundaries.

### Related

- [i668-emergent-testing-proof-type](../emergent_testing/todo.md) —
  proof leaves need function-valued schemas if `Proof` is derived from RTTI.
- [i143-rtti-data](todo.md) — serializable/function-free RTTI data
  form; extern function schemas may need to remain outside that core form.
