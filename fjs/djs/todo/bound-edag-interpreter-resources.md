## Bound EDAG validation and interpreter resources

**Priority:** P3
**Status:** open
**Blocked by:** [compile modules to EDAG before loading imports](./compile-modules-to-edag.md)

### Problem

The initial module-to-EDAG task introduces EDAG validation and a small FunctionalScript
interpreter, but it should not be blocked on production-grade resource accounting.

A hostile or simply very large EDAG can consume excessive time or memory during
validation or interpretation. Deep graphs can also overflow the host language call
stack if traversal is recursive. These constraints are important, but they are
orthogonal to the basic source -> EDAG -> load -> interpret pipeline and can be added
after that pipeline works.

### Proposal

Add deterministic resource limits around EDAG validation and interpretation without
changing EDAG semantics or its canonical representation.

Resource limits are runner/compiler inputs, **not EDAG metadata**. Therefore changing
a limit must not change the EDAG serialization, identity, or hash.

#### Time / work limit

Use an **instruction/work-step count**, not wall-clock time, as the deterministic
measure of computation time.

The budget should cover both validation and interpretation. Validation consumes the
budget first and passes the remainder to interpretation. Define precisely which
traversal/evaluation actions consume one step so independent implementations can
apply the same accounting.

#### Memory / structure-growth limit

Define a deterministic approximation for memory growth caused by EDAG evaluation.
For the initial interpreter this can count newly materialized object/array structure,
such as constructed objects, arrays, properties, and elements.

Shared EDAG nodes must be charged only according to the chosen materialization rule;
reusing a memoized result must not accidentally count as constructing the same value
again.

The goal is to stop runaway structure growth before the host runs out of memory, not
to model exact allocator byte counts.

#### Traversal without native-stack dependence

Validation and interpretation must not rely on recursive host calls for EDAG depth.
Use explicit work stacks/continuations and iterative traversal.

Work-stack growth itself must be bounded. In particular, charge/schedule work before
bulk-pushing arbitrarily many children so a wide or deeply nested EDAG cannot exhaust
host memory before the deterministic budget is checked.

#### Stopped outcomes

Resource exhaustion is not a parse error and should not be represented as a thrown
host exception.

Conceptually:

```text
CompileOutcome<T> = completed(T) | stopped(StopReason)

StopReason =
    instruction-limit
  | structure-growth-limit
```

Validation may also stop when the instruction budget is exhausted. If validation or
interpretation of an imported module stops, propagate that outcome through importing
modules without evaluating dependent parent EDAGs.

The public transpile/compile API must distinguish a deterministic stopped outcome from
source/load errors such as `ParseError`.

### Tasks

- [ ] Define the deterministic instruction/work-step accounting model for validation
      and interpretation.
- [ ] Make validation iterative and independent of the host call stack.
- [ ] Make interpreter traversal iterative and independent of the host call stack.
- [ ] Bound explicit validator/interpreter work-stack growth; do not bulk-push
      unbounded child lists before checking the budget.
- [ ] Share one per-module instruction budget between validation and interpretation;
      validation passes the remaining budget to interpretation.
- [ ] Define deterministic structure-growth accounting for constructed objects,
      arrays, properties, and elements.
- [ ] Ensure memoized/shared EDAG results are accounted for consistently and are not
      charged as newly materialized structure on every reference.
- [ ] Define `CompileOutcome` / `StopReason` (or equivalent) so resource exhaustion is
      distinct from parse/load errors.
- [ ] Propagate a stopped imported module to the root without interpreting dependent
      parent EDAGs.
- [ ] Define documented deterministic defaults for `fjs compile` and allow explicit
      overrides.
- [ ] Add proofs for instruction-limit and structure-growth-limit exhaustion.
- [ ] Add deeply nested and very wide EDAG proofs showing validation/interpretation do
      not throw `RangeError` or exhaust the native stack; they complete or stop
      through a deterministic limit.
- [ ] Verify resource limits do not participate in EDAG serialization or hashing.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — introduces the basic
  validator/interpreter pipeline this task hardens.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG semantics and node sharing.
