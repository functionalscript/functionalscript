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
own arguments/frame and therefore its own memo table for body nodes. Do **not** reuse a
memoized body result from one invocation in another merely because the EDAG node
identity is the same. For example, two calls to `x => [x]` with `1` and `2` must not
reuse the first call's `[1]`. Sharing of a body node remains memoized within each
individual invocation.

As the compiler lands the staged operators, the direct interpreter should support the
same EDAG forms: Stage 1 adds `.` property access; Stage 2 adds `frame`, `=>`, `()`, and
`.()`.

For Stage 2, evaluating `['=>', frame, body]` establishes the captured frame for the
new function. When that function is invoked, `['frame']` evaluates to that invocation's
captured frame, and indexed property access such as `['.', ['frame'], i]` reads a
captured value. The nested body's memoization context belongs to that invocation.

This TODO does not define resource budgets, deterministic stopped outcomes, iterative
host-stack hardening, or production limits. Those concerns belong to the resource
hardening TODO after the baseline interpreter exists.

### Tasks

- [ ] Implement a FunctionalScript interpreter for the compiler-supported EDAG subset.
- [ ] Validate the final EDAG before interpretation.
- [ ] Interpret EDAG operations directly; do not generate JavaScript from EDAG and run
      it through the host JavaScript engine.
- [ ] Support Stage 1 `['.', object, property]` property access.
- [ ] Support Stage 2 `['frame']`, `['=>', frame, body]`, `['()', object, args]`, and
      `['.()', object, property, args]` when those operators land.
- [ ] Memoize results by EDAG node identity within one evaluation context so shared
      constructors preserve reference identity.
- [ ] Start a fresh body-node memoization context for every function invocation; do
      not reuse memoized body results across different argument/frame contexts.
- [ ] Return the interpreted value for a valid final EDAG.
- [ ] Add proofs that primitive, array, object, property-access, import-resolved, and
      shared-node EDAGs evaluate to the expected values.
- [ ] Add Stage 2 proofs for functions, captured-frame access, ordinary calls, and
      method calls.
- [ ] Add an invocation-scope proof such as calling `x => [x]` with `1` and `2`:
      results contain the corresponding argument and do not reuse the constructed
      array across calls, while repeated references inside one call still share.
- [ ] Add a diamond/shared-node proof showing one shared EDAG node produces one shared
      runtime value within the relevant evaluation context.
- [ ] Add an integration proof that a multi-module program compiled/resolved to one
      final EDAG and then interpreted produces the same final value as the current DJS
      transpiler.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — produces the final
  EDAG this interpreter executes.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  adds deterministic resource and host-stack hardening after this baseline exists.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) — records
  the alternative strategy of compiling EDAG to an executable function.
