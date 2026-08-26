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

Add an RTTI form for functions, able to describe parameter types and a result
type, while keeping the runtime contract explicit: validating a function schema
should not pretend it can prove all future calls are valid.

> **Where the form lives is not settled here.** This section originally said
> "add an **extern** RTTI form", and the sketch below is written that way. That
> is one of two options, not a decision:
> [rtti-type-system](../../../../todo/rtti-type-system.md) made this issue its
> stage 7, and the 7a tasks below ask whether an extern form can actually pay
> for a `subset` path, a printer path, and a canonical serializable form, or
> whether function contracts have to go into
> [`data`](../data/README.md) proper. Read the API sketch below as a
> description of the runtime *contract* — which holds either way — rather than
> as a commitment to the representation.

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
  contracts, but the contract is enforced at call boundaries. **State its
  scope**: it is a limit on *runtime validation of an arbitrary function*, not
  on statically checking a definition the compiler can read — see the next
  task.

Added by [rtti-type-system](../../../../todo/rtti-type-system.md), which makes
this issue its stage 7. Completing only the tasks above would leave that stage
unfinished, and general inference and declaration retirement blocked with it.

**These four do not all run at the same point.** The epic's stage 6 (general
inference) sits between them: checking a definition needs the body's *inferred*
result, which is stage 6, while stage 6's general form needs the function
schema form from here. Split at the seam between representing a contract and
checking against one — the representation tasks (schema form, canonical
algebra, printer path, and the extern-vs-in-`data` decision that settles them)
are **7a** and run before stage 6; static checking of readable definitions is
**7b** and runs after it. Taking all four as one unit deadlocks against stage 6.

- [ ] **7b — static checking of readable definitions.** For a function defined in a
  compiler-readable module, no wrapper is needed: check the body's inferred
  result against the declared result schema, and each call site against the
  parameter schemas. The wrapper above is for *opaque* functions crossing a
  runtime boundary, and that is the only place its `Result` return is
  justified. Splitting the two by provenance is what keeps the API-changing
  wrapper off ordinary exported functions.

  **The split is over definitions; call sites split separately.** A readable
  definition makes the body checkable, and every call site the compiler can
  see checkable with it — but not a call it cannot see. A function exported to
  any consumer outside the compiler's view is that case: readable definition,
  foreign call site.
  Where the generated declaration is wider than the schema — `close`,
  `close(c, rest)`, non-finite numbers and `-0`, all listed under
  [the epic's `.d.ts` promise](../../../../todo/rtti-type-system.md) — the
  consumer can pass a value the declaration accepts and the schema rejects,
  with nothing between. That path is the epic's **stage 13** (ownership at the
  language boundary), not this issue. What stage 13 owes there splits by
  call site: where the call was **statically checked** against the declaration
  it is conditional on which `.d.ts` policy wins, since an exact declaration
  leaves nothing to adapt; for **every other call site** it is unconditional,
  because no declaration binds that caller — raw JavaScript, but equally a
  TypeScript caller going through `any`, a `@ts-ignore`, or a dynamic access.
  The callee cannot tell the two apart at run time, so the unconditional half
  is the one that sets the floor. Either way the check
  cannot be the wrapper above, whose `Result` return would change the published
  signature. Recorded here so this task is not read as "readable definition,
  therefore nothing to enforce".
- [ ] **7a — a place in the canonical algebra.** Everything downstream runs on the
  function-free [`data`](../data/README.md) form: the epic's stage 6 checks
  through `subset`, and its stage 1 printer goes `toData → dataToTs`. Either
  function contracts go into `data`, or extern schemas need an equivalent
  `subset` path. This is where **variance** enters — function inclusion is
  contravariant in parameters and covariant in results, and `subset` today is
  inclusion over kinds with no variance notion at all.
- [ ] **7a — a printer path**, so a function-typed export has a declaration to
  generate.
- [ ] **7a —** decide **extern vs in-`data`** for the representation. The
  Proposal above sketches extern and the Related note contemplates it, but
  neither settles it: the tasks above are what that choice has to pay for, and
  the decision is which option can. Whichever wins, update the Proposal to
  match rather than leaving the sketch reading as a commitment.
- [ ] **7a — a canonical serializable form that run time reuses.** The
  requirement the extern option most easily fails, and the one that is not
  about assignability or printing. The epic's stage 4 closes its
  schema-stability hole by serializing the compile-time schema through
  `toData`, and [`data`](../data/README.md) is function-free by construction —
  so an extern function schema is precisely what `toData` cannot pin. Without
  its own canonical form, a stateful imported thunk can present one contract
  while the compiler checks and another when `validate` runs. An extern path
  owes this in addition to a `subset` path and a printer; keeping function
  contracts inside `data` gets it for free.

### Related

- [i668-emergent-testing-proof-type](../../../emergent_testing/todo/668-emergent-testing-proof-type.md) —
  proof leaves need function-valued schemas if `Proof` is derived from RTTI.
- [`../data`](../data/README.md) — serializable/function-free RTTI data
  form; extern function schemas may need to remain outside that core form.
- [rtti-type-system](../../../../todo/rtti-type-system.md) — the epic; this
  document is its stage 7, and gates `//:` replacing `@type` on functions.
