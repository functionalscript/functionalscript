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
the compiler.

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

The interpreter must preserve EDAG node identity. If the same object/array constructor
node is referenced more than once, evaluate it once and reuse the same resulting
value. A memo table keyed by EDAG node identity is sufficient for the initial
implementation.

This TODO does not define resource budgets, deterministic stopped outcomes, iterative
host-stack hardening, or production limits. Those concerns belong to the resource
hardening TODO after the baseline interpreter exists.

### Tasks

- [ ] Implement a FunctionalScript interpreter for the compiler-supported EDAG subset.
- [ ] Validate the final EDAG before interpretation.
- [ ] Interpret EDAG operations directly; do not generate JavaScript from EDAG and run
      it through the host JavaScript engine.
- [ ] Memoize results by EDAG node identity so shared constructors preserve reference
      identity.
- [ ] Return the interpreted value for a valid final EDAG.
- [ ] Add proofs that primitive, array, object, import-resolved, and shared-node EDAGs
      evaluate to the expected values.
- [ ] Add a diamond/shared-node proof showing one shared EDAG node produces one shared
      runtime value.
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
