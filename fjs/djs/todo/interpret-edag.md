## Interpret a compiled EDAG directly

**Priority:** P3
**Status:** open

**Blocked by:** [`compile-modules-to-edag.md`](./compile-modules-to-edag.md)

### Goal

Provide a baseline FunctionalScript interpreter for a final compiled EDAG.

Module compilation and module resolution produce one final EDAG. Executing that EDAG
is a separate concern. One execution strategy is to interpret it directly; another is
to compile it to an executable function.

This TODO establishes only the basic direct-interpreter path. Deterministic time,
memory, and hostile-depth hardening are separate work in
[`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

### Proposal

Implement a small FunctionalScript EDAG interpreter for the EDAG forms supported by
the staged compiler work.

Conceptually:

```text
source modules
  -> resolve to final EDAG
  -> validate EDAG
  -> interpret EDAG
  -> value
```

Interpret the EDAG directly. Do **not** serialize or translate the EDAG back to
JavaScript and execute that generated JavaScript through the host engine; that would
make this an indirect code-generation path rather than an EDAG interpreter. Compiling
EDAG to an executable function is a separate strategy and can be developed
independently.

The interpreter must preserve EDAG node identity. Within one evaluation context, if
the same object/array constructor node is referenced more than once, evaluate it once
and reuse the same resulting value.

Function bodies require a narrower memoization scope. Each function invocation has its
own arguments and therefore its own memo table for body nodes. Do **not** reuse a
memoized body result from one invocation in another merely because the EDAG node
identity is the same. For example, two calls to `x => [x]` with `1` and `2` must not
reuse the first call's `[1]`. Sharing of a body node remains memoized within each
individual invocation.

As the compiler lands the staged operators, the direct interpreter should support the
same EDAG forms: Stage 1 adds `.` property access; Stage 2 adds non-capturing `=>` and
`()` — with the empty lambda for an ordinary call and a `['|.', property]` step for a
method call.

Stage 2 deliberately has **no frame support** — a restriction on *this interpreter*, not
on the EDAG schema: `fjs/edag/module.f.mjs` already validates `frame` as a general `exp`
and `['frame']` as its own node, ahead of any interpreter using either. This interpreter
accepts only the placeholder `null` for `frame` and does not evaluate `['frame']`.
Captured closures are deferred to later work.

A function body is a separate EDAG scope. Validation before interpretation must reject
operation-node identities shared across function boundaries; otherwise a single
semantic node could produce different runtime values in different invocation contexts.
Sharing within one body remains valid and is memoized per invocation.

### Existing value-producing API integration

The preceding P2 compiler work deliberately adds the EDAG-producing path **alongside**
the current value-producing DJS transpiler/CLI. Once this interpreter is available,
migrate the existing value-producing path to use EDAG internally:

```text
source modules
  -> final EDAG
  -> validate EDAG
  -> interpret EDAG
  -> exported value
  -> existing output serialization
```

This integration must preserve the public contract. `transpile` still returns the
module's evaluated exported value on success, and `fjs compile <input> <output>` still
serializes that value rather than serializing the EDAG as if it were the module result.
The separately serializable final EDAG remains a compiler artifact/API from the P2 task.

This TODO does not define resource budgets, deterministic stopped outcomes, iterative
host-stack hardening, or production limits. Those concerns belong to the resource
hardening TODO after the baseline interpreter exists.

### Tasks

- [ ] Implement a FunctionalScript interpreter for the compiler-supported EDAG subset.
- [ ] Validate the final EDAG before interpretation.
- [ ] Interpret EDAG operations directly; do not generate JavaScript from EDAG and run
      it through the host JavaScript engine.
- [ ] Support Stage 1 `['.', object, property]` property access.
- [ ] Support Stage 2 `['=>', null, body]` and `['()', object, lambda, args]` when
      those operators land — the empty lambda for an ordinary call, a trailing
      `['|.', property]` step for a method call, which supplies the `this` binding.
- [ ] Do **not** implement `['frame']` or non-empty closure frames in Stage 2.
- [ ] Memoize results by EDAG node identity within one evaluation context so shared
      constructors preserve reference identity.
- [ ] Start a fresh body-node memoization context for every function invocation; do
      not reuse memoized body results across different argument contexts.
- [ ] Reject EDAGs that share an operation node across a function boundary; keep body
      graphs disjoint while allowing sharing inside one body.
- [ ] Return the interpreted value for a valid final EDAG.
- [ ] Integrate final-EDAG interpretation behind the existing value-producing DJS
      `transpile` / `fjs compile` path without changing its success result/output.
- [ ] Add proofs that primitive, array, object, property-access, import-resolved, and
      shared-node EDAGs evaluate to the expected values.
- [ ] Add Stage 2 proofs for non-capturing functions, ordinary calls, and method calls.
- [ ] Whenever the optional nodes enter the interpreted subset, execute them per
      "Chains" in [`../../edag/README.md`](../../edag/README.md) — receiver state
      created by the property steps, consumed by the call steps and by an
      expression-level call whose lambda ends in one; an optional step's `index` or
      argument operand left unevaluated on its nullish branch, which the proofs must
      observe (`a?.[k]`, `f?.(...a)`), along with the short-circuit of the rest of
      that lambda array.
- [ ] Add an invocation-scope proof such as calling `x => [x]` with `1` and `2`:
      results contain the corresponding argument and do not reuse the constructed
      array across calls, while repeated references inside one call still share.
- [ ] Add a validation proof that an operation node reused both outside and inside a
      function body is rejected.
- [ ] Add a diamond/shared-node proof showing one shared EDAG node produces one shared
      runtime value within the relevant evaluation context.
- [ ] Add an integration proof that a multi-module program compiled/resolved to one
      final EDAG and then interpreted produces the same final value as the current DJS
      transpiler.
- [ ] Add a CLI/API compatibility proof that the existing value-producing `transpile`
      result and `fjs compile` output remain unchanged after switching their internals
      to final-EDAG interpretation.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — produces the final
  EDAG this interpreter executes while keeping the old value-producing callers in
  place until this integration lands.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  adds deterministic resource and host-stack hardening after this baseline exists.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) — records
  the alternative strategy of compiling EDAG to an executable function and its later
  open questions around nested functions/frames.
