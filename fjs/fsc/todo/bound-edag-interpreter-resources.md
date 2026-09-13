## Bound EDAG validation and interpreter resources

**Priority:** P4
**Status:** open
**Blocked by:** [`interpret-edag.md`](./interpret-edag.md)

### Problem

The baseline direct EDAG interpreter is intentionally separate from module compilation.
Once that interpreter exists, hostile or simply very large inputs can still consume
excessive work or memory, and recursive traversal can overflow the host language call
stack.

These constraints should be added after the basic interpreter works. They must not
change EDAG semantics, serialization, identity, or hash.

### Proposal

Add deterministic resource limits around the complete top-level EDAG processing
operation.

Resource limits are runner/compiler inputs, **not EDAG metadata**.

#### Whole-operation budget

Do not reset limits for each source module. A root compilation may traverse an
arbitrarily large module graph before producing the final EDAG, so per-module budgets
alone do not bound total work or retained structure.

Use one aggregate budget for the top-level operation and thread it through recursive
module processing, final-EDAG validation, and direct interpretation. More detailed
sub-budgets may be added later, but they must not allow aggregate work to become
unbounded by repeatedly resetting a per-module allowance.

#### Time / work limit

Use an **instruction/work-step count**, not wall-clock time, as the deterministic
measure of computation time. Define precisely which compiler, traversal, validation,
and evaluation actions consume one step so independent implementations can apply the
same accounting.

#### Memory / structure-growth limit

Define a deterministic approximation for memory growth caused by module resolution and
EDAG evaluation. For the initial interpreter this can count newly materialized
object/array structure, explicit work-stack growth, and other retained structures
covered by the chosen accounting rule.

Shared EDAG nodes must be charged only according to the chosen materialization rule;
reusing a memoized result must not accidentally count as constructing the same value
again.

The goal is to stop runaway growth before the host runs out of memory, not to model
exact allocator byte counts.

#### Traversal without native-stack dependence

Validation and interpretation must not rely on recursive host calls for EDAG depth.
Use explicit work stacks/continuations and iterative traversal.

Work-stack growth itself must be bounded. Charge/schedule work before bulk-pushing
arbitrarily many children so a wide or deeply nested EDAG cannot exhaust host memory
before the deterministic budget is checked.

#### Stopped outcomes

Resource exhaustion is not a parse error and should not be represented as a thrown
host exception.

Conceptually:

```text
Outcome<T> = completed(T) | stopped(StopReason)

StopReason =
    instruction-limit
  | structure-growth-limit
```

Validation may also stop when the aggregate instruction budget is exhausted. The
public API that enables these limits must distinguish a deterministic stopped outcome
from source/load errors such as `ParseError`.

### Tasks

- [ ] Define one aggregate deterministic work budget for the complete top-level
      compilation/execution operation; do not reset it per imported module.
- [ ] Define the deterministic instruction/work-step accounting model for module
      processing, validation, and interpretation.
- [ ] Make validation iterative and independent of the host call stack.
- [ ] Make interpreter traversal iterative and independent of the host call stack.
- [ ] Bound explicit validator/interpreter work-stack growth; do not bulk-push
      unbounded child lists before checking the budget.
- [ ] Define deterministic structure-growth accounting for retained compiler work and
      constructed objects, arrays, properties, and elements.
- [ ] Ensure memoized/shared EDAG results are accounted for consistently and are not
      charged as newly materialized structure on every reference.
- [ ] Define `Outcome` / `StopReason` (or equivalent) so resource exhaustion is
      distinct from parse/load errors.
- [ ] Define documented deterministic defaults and allow explicit overrides.
- [ ] Add proofs showing a very large module graph cannot evade the aggregate limit by
      keeping every individual module below a per-module threshold.
- [ ] Add proofs for instruction-limit and structure-growth-limit exhaustion.
- [ ] Add deeply nested and very wide EDAG proofs showing validation/interpretation do
      not throw `RangeError` or exhaust the native stack; they complete or stop
      through a deterministic limit.
- [ ] Verify resource limits do not participate in EDAG serialization or hashing.
- [ ] `tsc`, `fjs test`.

### Related

- [`interpret-edag.md`](./interpret-edag.md) — provides the baseline direct EDAG
  interpreter this TODO hardens.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — resolves the source
  module graph to the final EDAG before execution.
- [`../../../todo/edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  — EDAG semantics and node sharing.
